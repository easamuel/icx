import argon2 from 'argon2';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runSeed(): Promise<void> {
  console.log('[ICX-DB] Seeding ICX Studios production baseline data...');

  const defaultPasswordHash = await argon2.hash('IcxStudios#2026!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await withTransaction(async (client) => {
    // 1. Seed Core Role Accounts (Admin, Editor, Photographer, Customer)
    const adminRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, phone, full_name, status, email_verified_at)
       VALUES ('admin@icxstudios.com', $1, 'admin', '+2348010000001', 'ICX Executive Admin', 'active', NOW())
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [defaultPasswordHash]
    );

    const editorRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, phone, full_name, status, email_verified_at)
       VALUES ('editor@icxstudios.com', $1, 'editor', '+2348010000002', 'Tunde Senior Retoucher', 'active', NOW())
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [defaultPasswordHash]
    );

    const photogUserRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, phone, full_name, status, email_verified_at)
       VALUES ('photographer@icxstudios.com', $1, 'photographer', '+2348010000003', 'Amara Nwosu Studios', 'active', NOW())
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [defaultPasswordHash]
    );

    await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, phone, full_name, status, email_verified_at)
       VALUES ('customer@icxstudios.com', $1, 'customer', '+2348010000004', 'Chidi Okafor', 'active', NOW())
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [defaultPasswordHash]
    );

    const photogUserId = photogUserRes.rows[0]!.id;

    // 2. Seed Approved Photographer Profile & Availability Slots
    const photogProfileRes = await client.query<{ id: string }>(
      `INSERT INTO photographer_profiles (
         user_id, bio, location, rating, approval_status, portfolio_urls, services_and_prices
       )
       VALUES (
         $1,
         'Editorial portrait, commercial fashion, and luxury wedding photographer with 9+ years of studio and on-location mastery.',
         'Victoria Island, Lagos',
         4.95,
         'approved',
         $2::jsonb,
         $3::jsonb
       )
       ON CONFLICT (user_id) DO UPDATE SET
         approval_status = 'approved',
         services_and_prices = EXCLUDED.services_and_prices
       RETURNING id`,
      [
        photogUserId,
        JSON.stringify([
          '/assets/portfolio/editorial-01.jpg',
          '/assets/portfolio/studio-portrait-02.jpg',
          '/assets/portfolio/commercial-03.jpg',
        ]),
        JSON.stringify([
          {
            title: 'Executive Portrait Session (2 Hours)',
            description: 'In-studio lighting setup, 3 outfit changes, 15 high-end retouched deliverables.',
            price: 15000000, // ₦150,000 in kobo
            duration_hours: 2,
          },
          {
            title: 'Full-Day Commercial Campaign (8 Hours)',
            description: 'Full crew support, tethered capture, and commercial licensing.',
            price: 48000000, // ₦480,000 in kobo
            duration_hours: 8,
          },
        ]),
      ]
    );

    const photogProfileId = photogProfileRes.rows[0]!.id;

    // Seed future availability slots if none exist
    const existingSlots = await client.query(
      'SELECT 1 FROM availability_slots WHERE photographer_id = $1 LIMIT 1',
      [photogProfileId]
    );
    if (existingSlots.rowCount === 0) {
      await client.query(
        `INSERT INTO availability_slots (photographer_id, start_time, end_time, status)
         VALUES
           ($1, NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days 3 hours', 'free'),
           ($1, NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days 4 hours', 'free'),
           ($1, NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days 8 hours', 'free')`,
        [photogProfileId]
      );
    }

    // 3. Seed Photo Editing Packages (Prices stored in kobo: 1 NGN = 100 Kobo)
    await client.query(`
      INSERT INTO edit_packages (name, description, price_per_picture, turnaround_hours, free_revisions, active)
      VALUES
        (
          'Essential Studio Color & Exposure',
          'Precision color grading, white balance calibration, exposure recovery, and lens profile correction.',
          250000,
          24,
          1,
          true
        ),
        (
          'High-End Editorial Frequency Separation',
          'Full frequency separation skin retouching, dodge & burn contouring, stray hair removal, and commercial color grade.',
          600000,
          48,
          3,
          true
        ),
        (
          'Commercial Campaign Master Composite',
          'Complex background replacement, product reflection sculpting, multi-plate compositing, and 16-bit TIFF print mastering.',
          1200000,
          72,
          5,
          true
        )
      ON CONFLICT (name) DO UPDATE SET
        price_per_picture = EXCLUDED.price_per_picture,
        turnaround_hours = EXCLUDED.turnaround_hours,
        free_revisions = EXCLUDED.free_revisions
    `);

    // 4. Seed Studio Equipment Inventory
    const existingEquip = await client.query('SELECT 1 FROM equipment_items LIMIT 1');
    if (existingEquip.rowCount === 0) {
      await client.query(`
        INSERT INTO equipment_items (name, description, photos, daily_price, total_units, condition, active)
        VALUES
          (
            'Sony Alpha A1 50.1MP Full-Frame Mirrorless Body',
            'Flagship 50MP stacked CMOS sensor, 8K 30p video, 30fps blackout-free shooting with dual CFexpress Type A cards.',
            '["/assets/equipment/sony-a1.jpg"]'::jsonb,
            6500000,
            3,
            'excellent',
            true
          ),
          (
            'Profoto Pro-11 2400 AirTTL Studio Generator Kit',
            'Ultimate studio flash pack with 2x ProHead Plus flash heads, 1/80,000s freeze duration, and AirX wireless sync.',
            '["/assets/equipment/profoto-pro11.jpg"]'::jsonb,
            9500000,
            2,
            'excellent',
            true
          ),
          (
            'RED V-RAPTOR 8K VV Cinema Camera Production Pack',
            'Full-frame 8K Vista Vision cinema camera rigged with V-Lock expander, 7" DSMC3 Touch LCD, and 2TB RED PRO CFexpress.',
            '["/assets/equipment/red-vraptor.jpg"]'::jsonb,
            22000000,
            1,
            'good',
            true
          )
      `);
    }

    // 5. Log seed execution in audit_events
    await client.query(
      `INSERT INTO audit_events (actor_id, action, target_entity, target_id, details)
       VALUES ($1, 'SYSTEM_SEED_COMPLETED', 'platform_settings', NULL, $2::jsonb)`,
      [
        adminRes.rows[0]!.id,
        JSON.stringify({
          editor_id: editorRes.rows[0]!.id,
          seeded_at: new Date().toISOString(),
        }),
      ]
    );
  });

  console.log('[ICX-DB] Seed completed successfully.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runSeed()
    .then(() => pool.end())
    .catch((err) => {
      console.error('[ICX-DB] Seed failed:', err);
      process.exit(1);
    });
}

