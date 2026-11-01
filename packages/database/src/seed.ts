import argon2 from 'argon2';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, withTransaction } from './index.js';

export async function runSeed(): Promise<void> {
  console.log('[ICX-DB] Seeding ICX Studios production catalog & master rosters...');

  const defaultPasswordHash = await argon2.hash('IcxStudios#2026!', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await withTransaction(async (client) => {
    // 1. Seed Core Role Accounts
    const adminRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, phone, full_name, status, email_verified_at)
       VALUES ('admin@icxstudios.com', $1, 'admin', '+2348010000001', 'ICX Executive Director', 'active', NOW())
       ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [defaultPasswordHash]
    );

    const editorRes = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, role, phone, full_name, status, email_verified_at)
       VALUES ('editor@icxstudios.com', $1, 'editor', '+2348010000002', 'Tunde Bakare (Lead Colorist)', 'active', NOW())
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

    // 2. Seed Roster of 4 Approved Master Photographers with Real High-Res Portfolios
    const photographerRoster = [
      {
        email: 'photographer@icxstudios.com',
        phone: '+2348010000003',
        full_name: 'Amara Nwosu Studios',
        location: 'Victoria Island, Lagos',
        rating: 4.98,
        bio: 'Vogue-published editorial portrait, luxury fashion, and commercial campaign photographer with 9+ years of studio and location lighting mastery across Lagos, London, and Paris.',
        portfolio_urls: [
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=85',
        ],
        services: [
          {
            title: 'Executive & Editorial Portrait Session (2 Hours)',
            description: 'Full Profoto studio lighting setup, 3 wardrobe changes, and 15 master-retouched deliverables.',
            price: 15000000, // ₦150,000
            duration_hours: 2,
          },
          {
            title: 'Half-Day Fashion Lookbook Shoot (4 Hours)',
            description: 'Tethered Capture One workstation, creative direction, and 35 high-resolution commercial assets.',
            price: 28000000, // ₦280,000
            duration_hours: 4,
          },
          {
            title: 'Full-Day Commercial Brand Campaign (8 Hours)',
            description: 'Complete lighting crew, digital tech, multi-set production, and full commercial usage licensing.',
            price: 48000000, // ₦480,000
            duration_hours: 8,
          },
        ],
      },
      {
        email: 'kolawole@icxstudios.com',
        phone: '+2348010000005',
        full_name: 'Kolawole Olanrewaju Visuals',
        location: 'Ikoyi, Lagos',
        rating: 4.95,
        bio: 'Destination wedding, society bridal, and architectural lifestyle photographer renowned for timeless medium-format tonal depth and cinematic storytelling.',
        portfolio_urls: [
          'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=1000&q=85',
        ],
        services: [
          {
            title: 'Pre-Wedding & Couple Editorial (3 Hours)',
            description: 'Two iconic Lagos locations or studio sets, 25 retouched fine-art photographs.',
            price: 22000000, // ₦220,000
            duration_hours: 3,
          },
          {
            title: 'Luxury Wedding Full-Day Coverage (10 Hours)',
            description: 'Lead photographer + second shooter, drone aerials, and 400+ color-graded deliverables.',
            price: 65000000, // ₦650,000
            duration_hours: 10,
          },
        ],
      },
      {
        email: 'zainab@icxstudios.com',
        phone: '+2348010000006',
        full_name: 'Zainab Ibrahim Studio',
        location: 'Maitama, Abuja',
        rating: 4.92,
        bio: 'Corporate board portraiture, diplomatic events, and high-key beauty campaigns across Abuja and Northern Nigeria.',
        portfolio_urls: [
          'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=1000&q=85',
        ],
        services: [
          {
            title: 'C-Suite & Boardroom Portrait Package (2 Hours)',
            description: 'On-location mobile studio or Maitama studio session for executives and founders.',
            price: 18000000, // ₦180,000
            duration_hours: 2,
          },
          {
            title: 'Beauty & Cosmetics Macro Campaign (5 Hours)',
            description: 'High-resolution 100MP medium format capture for skincare, jewelry, and beauty brands.',
            price: 35000000, // ₦350,000
            duration_hours: 5,
          },
        ],
      },
      {
        email: 'david@icxstudios.com',
        phone: '+2348010000007',
        full_name: 'David Adeleke Commercial',
        location: 'Lekki Phase 1, Lagos',
        rating: 4.96,
        bio: 'Product, culinary, e-commerce lookbook, and architectural interior specialist delivering razor-sharp commercial visuals for Africa’s fastest-growing brands.',
        portfolio_urls: [
          'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=85',
          'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1000&q=85',
        ],
        services: [
          {
            title: 'Commercial Product & Packshot Session (4 Hours)',
            description: 'Up to 20 SKUs styled and lit on pure white or bespoke architectural surfaces.',
            price: 20000000, // ₦200,000
            duration_hours: 4,
          },
          {
            title: 'Luxury Real Estate & Interior Architecture Shoot (6 Hours)',
            description: 'Tilt-shift architectural perspectives, twilight exteriors, and HDR interior mastering.',
            price: 32000000, // ₦320,000
            duration_hours: 6,
          },
        ],
      },
    ];

    for (const photog of photographerRoster) {
      const userRes = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, role, phone, full_name, status, email_verified_at)
         VALUES ($1, $2, 'photographer', $3, $4, 'active', NOW())
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [photog.email, defaultPasswordHash, photog.phone, photog.full_name]
      );
      const userId = userRes.rows[0]!.id;

      const profileRes = await client.query<{ id: string }>(
        `INSERT INTO photographer_profiles (
           user_id, bio, location, rating, approval_status, portfolio_urls, services_and_prices
         )
         VALUES ($1, $2, $3, $4, 'approved', $5::jsonb, $6::jsonb)
         ON CONFLICT (user_id) DO UPDATE SET
           bio = EXCLUDED.bio,
           location = EXCLUDED.location,
           rating = EXCLUDED.rating,
           approval_status = 'approved',
           portfolio_urls = EXCLUDED.portfolio_urls,
           services_and_prices = EXCLUDED.services_and_prices
         RETURNING id`,
        [
          userId,
          photog.bio,
          photog.location,
          photog.rating,
          JSON.stringify(photog.portfolio_urls),
          JSON.stringify(photog.services),
        ]
      );
      const profileId = profileRes.rows[0]!.id;

      const existingSlots = await client.query(
        'SELECT 1 FROM availability_slots WHERE photographer_id = $1 LIMIT 1',
        [profileId]
      );
      if (existingSlots.rowCount === 0) {
        await client.query(
          `INSERT INTO availability_slots (photographer_id, start_time, end_time, status)
           VALUES
             ($1, DATE_TRUNC('hour', NOW()) + INTERVAL '1 day 10 hours', DATE_TRUNC('hour', NOW()) + INTERVAL '1 day 13 hours', 'free'),
             ($1, DATE_TRUNC('hour', NOW()) + INTERVAL '2 days 14 hours', DATE_TRUNC('hour', NOW()) + INTERVAL '2 days 18 hours', 'free'),
             ($1, DATE_TRUNC('hour', NOW()) + INTERVAL '4 days 9 hours', DATE_TRUNC('hour', NOW()) + INTERVAL '4 days 13 hours', 'free'),
             ($1, DATE_TRUNC('hour', NOW()) + INTERVAL '6 days 11 hours', DATE_TRUNC('hour', NOW()) + INTERVAL '6 days 17 hours', 'free')`,
          [profileId]
        );
      }
    }

    // 3. Seed Studio Photo Editing Packages
    await client.query(`
      INSERT INTO edit_packages (name, description, price_per_picture, turnaround_hours, free_revisions, active)
      VALUES
        (
          'Essential Studio Color & Exposure',
          'Precision RAW color grading, skin-true white balance calibration, dynamic range recovery, and optical lens profile correction.',
          250000,
          24,
          1,
          true
        ),
        (
          'High-End Editorial Frequency Separation',
          'Bespoke frequency separation skin texture preservation, micro dodge & burn contouring, flyaway hair cleanup, and magazine-grade color science.',
          600000,
          48,
          3,
          true
        ),
        (
          'Commercial Campaign Master Composite',
          'Complex studio background reconstruction, specular product reflection sculpting, multi-plate compositing, and 16-bit CMYK/RGB print mastering.',
          1200000,
          72,
          5,
          true
        )
      ON CONFLICT (name) DO UPDATE SET
        description = EXCLUDED.description,
        price_per_picture = EXCLUDED.price_per_picture,
        turnaround_hours = EXCLUDED.turnaround_hours,
        free_revisions = EXCLUDED.free_revisions
    `);

    // 4. Seed & Update Studio Equipment Inventory with High-Res Product Imagery
    const equipmentCatalog = [
      {
        name: 'Sony Alpha A1 50.1MP Full-Frame Mirrorless Body',
        description: 'Flagship 50.1MP stacked Exmor RS CMOS sensor, 8K 30p 10-bit 4:2:2 video, 30fps blackout-free capture, dual 160GB CFexpress Type A cards & 3x FZ100 batteries.',
        photos: ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1000&q=85'],
        daily_price: 6500000, // ₦65,000/day
        total_units: 3,
      },
      {
        name: 'Profoto Pro-11 2400 AirTTL Studio Generator Kit',
        description: 'Industry-standard 2400Ws studio generator with 2x ProHead Plus flash heads, 1/80,000s freeze duration, AirX Bluetooth sync, and 5ft RFi Octa Softbox.',
        photos: ['https://images.unsplash.com/photo-1527011046414-4781f1f94f8c?auto=format&fit=crop&w=1000&q=85'],
        daily_price: 9500000, // ₦95,000/day
        total_units: 2,
      },
      {
        name: 'RED V-RAPTOR 8K VV Cinema Camera Production Pack',
        description: 'Full-frame 8K Vista Vision 120fps cinema package rigged with V-Lock I/O expander, 7" DSMC3 Touch LCD, Tilta matte box, and 2TB RED PRO CFexpress.',
        photos: ['https://images.unsplash.com/photo-1589872307379-0ffdf9829123?auto=format&fit=crop&w=1000&q=85'],
        daily_price: 22000000, // ₦220,000/day
        total_units: 2,
      },
      {
        name: 'Hasselblad X2D 100C Medium Format + XCD 55V & 90V Kit',
        description: '100MP BSI CMOS medium format sensor with 16-bit color depth, 15-stop dynamic range, 5-axis 7-stop IBIS, and 1TB internal SSD for luxury commercial print.',
        photos: ['https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1000&q=85'],
        daily_price: 14500000, // ₦145,000/day
        total_units: 2,
      },
      {
        name: 'Sony FE G-Master II Trinity Lens Case (16-35 / 24-70 / 70-200 f/2.8)',
        description: 'Complete Mark II G-Master constant f/2.8 zoom trinity in Pelican 1510 flight case with variable ND and polariser filter kit.',
        photos: ['https://images.unsplash.com/photo-1617005082133-548c4dd27f35?auto=format&fit=crop&w=1000&q=85'],
        daily_price: 5500000, // ₦55,000/day
        total_units: 4,
      },
      {
        name: 'Aputure Electro Storm XT26 + Light Dome 150 Cinema Lighting Kit',
        description: '2600W high-output bi-color point-source LED with motorized yoke, LumenRadio CRMX, heavy-duty Avenger crank stand, and 5ft parabolic modifier.',
        photos: ['https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=1000&q=85'],
        daily_price: 7500000, // ₦75,000/day
        total_units: 3,
      },
    ];

    for (const item of equipmentCatalog) {
      const existing = await client.query<{ id: string }>(
        'SELECT id FROM equipment_items WHERE name = $1 LIMIT 1',
        [item.name]
      );
      if (existing.rowCount && existing.rows[0]) {
        await client.query(
          `UPDATE equipment_items
           SET description = $1, photos = $2::jsonb, daily_price = $3, total_units = $4
           WHERE id = $5`,
          [item.description, JSON.stringify(item.photos), item.daily_price, item.total_units, existing.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO equipment_items (name, description, photos, daily_price, total_units, condition, active)
           VALUES ($1, $2, $3::jsonb, $4, $5, 'excellent', true)`,
          [item.name, item.description, JSON.stringify(item.photos), item.daily_price, item.total_units]
        );
      }
    }

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
