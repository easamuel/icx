import { Router, type Request, type Response } from 'express';
import { query, withTransaction, recordAuditEvent } from '@icx/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { issueTokenPair } from '../lib/jwt.js';
import {
  dispatchNotification,
  buildStudioEmailTemplate,
  escapeHtml,
} from '../engines/notification.engine.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const adminRouter = Router();

// All Executive Admin routes strictly require 'admin' role (AC-07)
adminRouter.use(requireAuth, requireRole('admin'));

// ============================================================================
// 1. GET /api/v1/admin/overview (AD-11: Daily Active Metrics & Executive Summary)
// ============================================================================
adminRouter.get('/overview', async (_req: Request, res: Response): Promise<void> => {
  const [
    jobsMetrics,
    bookingsMetrics,
    rentalsMetrics,
    pendingPhotographers,
    financeMetrics,
    editorsRes,
    settingsRes,
  ] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('in_queue', 'in_editing', 'revision'))::int AS active_jobs,
        COUNT(*) FILTER (WHERE status = 'ready_for_review')::int AS awaiting_review,
        COUNT(*) FILTER (WHERE status = 'delivered')::int AS delivered_jobs
      FROM edit_orders
    `),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('requested', 'accepted', 'awaiting_payment', 'confirmed'))::int AS upcoming_bookings,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_bookings,
        COALESCE(SUM(commission_amount) FILTER (WHERE status = 'completed'), 0)::text AS total_commission_kobo
      FROM bookings
    `),
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'out')::int AS items_out_on_rental,
        COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_pickups,
        COUNT(*) FILTER (WHERE status = 'held' AND held_until > NOW())::int AS active_holds
      FROM rentals
    `),
    query(`
      SELECT COUNT(*)::int AS pending_applications
      FROM photographer_profiles
      WHERE approval_status = 'pending'
    `),
    query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE type != 'refund'), 0)::text AS gross_revenue_kobo,
        COALESCE(SUM(amount) FILTER (WHERE type = 'deposit'), 0)::text AS deposits_kobo,
        COALESCE(SUM(amount) FILTER (WHERE type = 'balance'), 0)::text AS balances_kobo
      FROM payments
    `),
    query(`
      SELECT id, full_name, email, role, status
      FROM users
      WHERE role IN ('editor', 'admin') AND status = 'active'
      ORDER BY full_name ASC
    `),
    query('SELECT key, value FROM platform_settings'),
  ]);

  const settingsMap: Record<string, unknown> = {};
  for (const row of settingsRes.rows) {
    settingsMap[row.key] = row.value;
  }

  res.status(200).json({
    metrics: {
      jobs: jobsMetrics.rows[0],
      bookings: bookingsMetrics.rows[0],
      rentals: rentalsMetrics.rows[0],
      pendingPhotographerApplications: pendingPhotographers.rows[0]?.pending_applications ?? 0,
      finance: financeMetrics.rows[0],
    },
    staffEditors: editorsRes.rows,
    platformSettings: settingsMap,
  });
});

// ============================================================================
// 2. PHOTOGRAPHER ONBOARDING & APPROVALS (AD-01)
// ============================================================================
adminRouter.get('/photographers', async (_req: Request, res: Response): Promise<void> => {
  const resPhotogs = await query(`
    SELECT pp.*, u.full_name, u.email, u.phone, u.status AS user_status, u.email_verified_at
    FROM photographer_profiles pp
    JOIN users u ON u.id = pp.user_id
    ORDER BY
      CASE WHEN pp.approval_status = 'pending' THEN 0 ELSE 1 END,
      pp.created_at DESC
  `);

  res.status(200).json({ photographers: resPhotogs.rows });
});

adminRouter.patch(
  '/photographers/:profileId/status',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const profileId = String(req.params.profileId || '');
      if (!UUID_REGEX.test(profileId)) {
        res.status(400).json({
          error: 'INVALID_PROFILE_ID',
          message: 'Invalid photographer profile ID.',
        });
        return;
      }
      const approvalStatus = req.body?.approval_status as
        | 'pending'
        | 'approved'
        | 'suspended'
        | 'rejected';
      const rejectionReason =
        typeof req.body?.rejection_reason === 'string' && req.body.rejection_reason.trim().length > 0
          ? req.body.rejection_reason.trim()
          : null;

      if (!['pending', 'approved', 'suspended', 'rejected'].includes(approvalStatus)) {
        res.status(400).json({
          error: 'INVALID_APPROVAL_STATUS',
          message: 'Approval status must be pending, approved, suspended, or rejected.',
        });
        return;
      }

      if (approvalStatus === 'rejected' && (!rejectionReason || rejectionReason.length < 5)) {
        res.status(400).json({
          error: 'REJECTION_REASON_REQUIRED',
          message: 'Please provide a clear rejection reason (at least 5 characters).',
        });
        return;
      }

      const reviewerId = req.user?.sub && UUID_REGEX.test(req.user.sub) ? req.user.sub : null;

      const updated = await withTransaction(async (client) => {
        const existingRes = await client.query<{
          id: string;
          user_id: string;
          email: string;
          full_name: string;
          email_verified_at: Date | null;
        }>(
          `SELECT pp.id, pp.user_id, u.email, u.full_name, u.email_verified_at
           FROM photographer_profiles pp
           JOIN users u ON u.id = pp.user_id
           WHERE pp.id = $1::uuid
           LIMIT 1`,
          [profileId]
        );
        const existing = existingRes.rows[0];
        if (!existing) return { notFound: true as const };

        if (approvalStatus === 'approved') {
          await client.query(
            `UPDATE users
             SET email_verified_at = COALESCE(email_verified_at, NOW()),
                 status = 'active',
                 updated_at = NOW()
             WHERE id = $1::uuid`,
            [existing.user_id]
          );
        }

        const profileRes = await client.query<{
          id: string;
          user_id: string;
          approval_status: string;
          rejection_reason: string | null;
        }>(
          `UPDATE photographer_profiles
           SET approval_status = $1::varchar,
               rejection_reason = CASE WHEN $1::text = 'rejected' THEN $2::text ELSE NULL END,
               reviewed_at = NOW(),
               reviewed_by = $3::uuid
           WHERE id = $4::uuid
           RETURNING id, user_id, approval_status, rejection_reason`,
          [approvalStatus, rejectionReason, reviewerId, profileId]
        );
        const profile = profileRes.rows[0]!;

        await recordAuditEvent(
          {
            actorId: reviewerId,
            action: `PHOTOGRAPHER_STATUS_${approvalStatus.toUpperCase()}`,
            targetEntity: 'photographer_profiles',
            targetId: profile.id,
            details: { approvalStatus, rejectionReason },
          },
          client
        );

        return {
          notFound: false as const,
          profile,
          email: existing.email,
          fullName: existing.full_name,
        };
      });

      if (updated.notFound) {
        res.status(404).json({
          error: 'PHOTOGRAPHER_NOT_FOUND',
          message: 'Photographer profile record was not found.',
        });
        return;
      }

      const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com').replace(/\/$/, '');

      if (approvalStatus === 'approved' && updated.email) {
        void dispatchNotification({
          triggerId: 'NT-07',
          recipientEmail: updated.email,
          recipientUserId: updated.profile.user_id,
          subject: 'Your ICXORA Photographer Application Is Approved!',
          htmlBody: buildStudioEmailTemplate({
            heading: `Welcome to the ICXORA Roster, ${escapeHtml(updated.fullName)}.`,
            subheading: 'Your photographer profile and proof-of-work portfolio have been approved.',
            bodyHtml: `
              <p style="margin:0 0 14px;">Congratulations! Your photographer application has passed review and is now live in the ICXORA booking directory.</p>
              <p style="margin:0;">Sign in to your Photographer Portal to manage your availability and upcoming client sessions.</p>
            `,
            ctaLabel: 'Open Photographer Portal',
            ctaUrl: `${webUrl}/portal/photographer`,
          }),
          targetEntity: 'photographer_profiles',
          targetId: updated.profile.id,
        }).catch((err) => {
          console.error('[ICX-ADMIN] Failed to send photographer approval notification:', err);
        });
      } else if (approvalStatus === 'rejected' && updated.email) {
        void dispatchNotification({
          triggerId: 'NT-07-REJECT',
          recipientEmail: updated.email,
          recipientUserId: updated.profile.user_id,
          subject: 'Update on Your ICXORA Photographer Application',
          htmlBody: buildStudioEmailTemplate({
            heading: `Application Update for ${escapeHtml(updated.fullName)}`,
            subheading: 'Your photographer application was not approved at this time.',
            bodyHtml: `
              <p style="margin:0 0 12px;">Our curation team reviewed your submission and could not approve it for the live directory right now.</p>
              <p style="margin:0 0 12px;"><strong>Reviewer Feedback:</strong> ${escapeHtml(rejectionReason || '')}</p>
              <p style="margin:0;">If you have updated portfolio work or questions, please contact support@icxora.com.</p>
            `,
            ctaLabel: 'View Application Status',
            ctaUrl: `${webUrl}/photographer/status`,
          }),
          targetEntity: 'photographer_profiles',
          targetId: updated.profile.id,
        }).catch((err) => {
          console.error('[ICX-ADMIN] Failed to send photographer rejection notification:', err);
        });
      }

      res.status(200).json({ profile: updated.profile });
    } catch (err) {
      console.error('[ICX-ADMIN] Photographer status update failed:', err);
      res.status(500).json({
        error: 'PHOTOGRAPHER_STATUS_UPDATE_FAILED',
        message: err instanceof Error ? err.message : 'Unable to update photographer approval status.',
      });
    }
  }
);

// ============================================================================
// 3. EDITING JOB MANAGEMENT & OFFLINE EDITOR ASSIGNMENT (AD-02)
// Assign job to registered editor, to admin self, or to an offline editor by name.
// ============================================================================
adminRouter.get('/jobs', async (_req: Request, res: Response): Promise<void> => {
  const jobsRes = await query(`
    SELECT
      eo.*,
      ep.name AS package_name,
      u.full_name AS customer_name,
      u.email AS customer_email,
      assignee.full_name AS assignee_name,
      (SELECT COUNT(*) FROM photos p WHERE p.order_id = eo.id)::int AS uploaded_count,
      (SELECT COUNT(*) FROM photos p WHERE p.order_id = eo.id AND p.edited_storage_key IS NOT NULL)::int AS edited_count
    FROM edit_orders eo
    JOIN edit_packages ep ON ep.id = eo.package_id
    JOIN users u ON u.id = eo.customer_id
    LEFT JOIN users assignee ON assignee.id = eo.assignee_id
    ORDER BY eo.created_at DESC
  `);

  res.status(200).json({ jobs: jobsRes.rows });
});

adminRouter.patch(
  '/jobs/:orderId/assign',
  async (req: Request, res: Response): Promise<void> => {
    const orderId = String(req.params.orderId || '');
    const { assignee_id, offline_editor_name, status } = req.body as {
      assignee_id?: string | null;
      offline_editor_name?: string | null;
      status?: string;
    };

    const updated = await query(
      `UPDATE edit_orders
       SET assignee_id = $1,
           offline_editor_name = $2,
           status = COALESCE($3, CASE WHEN status = 'in_queue' THEN 'in_editing' ELSE status END)
       WHERE id = $4
       RETURNING *`,
      [assignee_id ?? null, offline_editor_name ?? null, status ?? null, orderId]
    );

    if (!updated.rows[0]) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND' });
      return;
    }

    await recordAuditEvent({
      actorId: req.user!.sub,
      action: 'ADMIN_ASSIGNED_EDIT_JOB',
      targetEntity: 'edit_orders',
      targetId: orderId,
      details: {
        assigneeId: assignee_id ?? null,
        offlineEditorName: offline_editor_name ?? null,
      },
    });

    if (assignee_id) {
      const editorUser = await query<{ email: string }>(
        'SELECT email FROM users WHERE id = $1 LIMIT 1',
        [assignee_id]
      );
      if (editorUser.rows[0]?.email) {
        await dispatchNotification({
          triggerId: 'NT-05',
          recipientEmail: editorUser.rows[0].email,
          recipientUserId: assignee_id,
          subject: `New Editing Job Assigned (#${orderId.slice(0, 8)})`,
          htmlBody: `<p>An administrator has assigned editing job <strong>#${orderId.slice(0, 8)}</strong> to your workspace queue.</p>`,
          targetEntity: 'edit_orders',
          targetId: orderId,
        });
      }
    }

    res.status(200).json({ order: updated.rows[0] });
  }
);

// ============================================================================
// 4. EQUIPMENT INVENTORY & RENTAL GANTT CALENDAR MANAGER (AD-04, AD-05)
// ============================================================================
adminRouter.get('/equipment', async (_req: Request, res: Response): Promise<void> => {
  const equipRes = await query('SELECT * FROM equipment_items ORDER BY name ASC');
  const rentalsRes = await query(`
    SELECT r.*, ei.name AS item_name, u.full_name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
    FROM rentals r
    JOIN equipment_items ei ON ei.id = r.item_id
    JOIN users u ON u.id = r.customer_id
    ORDER BY r.start_date DESC
  `);

  res.status(200).json({
    equipment: equipRes.rows,
    rentals: rentalsRes.rows,
  });
});

adminRouter.post('/equipment', async (req: Request, res: Response): Promise<void> => {
  const { name, description, photos, daily_price, total_units, condition, active } =
    req.body;

  const insertRes = await query(
    `INSERT INTO equipment_items (name, description, photos, daily_price, total_units, condition, active)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
     RETURNING *`,
    [
      name,
      description ?? '',
      JSON.stringify(photos ?? []),
      String(daily_price),
      Number(total_units),
      condition || 'excellent',
      active ?? true,
    ]
  );

  await recordAuditEvent({
    actorId: req.user!.sub,
    action: 'EQUIPMENT_ITEM_CREATED',
    targetEntity: 'equipment_items',
    targetId: insertRes.rows[0]!.id,
    details: { name, daily_price, total_units },
  });

  res.status(201).json({ item: insertRes.rows[0] });
});

adminRouter.patch(
  '/equipment/:itemId',
  async (req: Request, res: Response): Promise<void> => {
    const itemId = String(req.params.itemId || '');
    const { name, description, photos, daily_price, total_units, condition, active } = req.body;

    const updated = await query(
      `UPDATE equipment_items
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           daily_price = COALESCE($3, daily_price),
           total_units = COALESCE($4, total_units),
           condition = COALESCE($5, condition),
           active = COALESCE($6, active),
           photos = COALESCE($7::jsonb, photos)
       WHERE id = $8
       RETURNING *`,
      [
        name ?? null,
        description ?? null,
        daily_price !== undefined ? String(daily_price) : null,
        total_units !== undefined ? Number(total_units) : null,
        condition ?? null,
        active !== undefined ? Boolean(active) : null,
        Array.isArray(photos) ? JSON.stringify(photos) : null,
        itemId,
      ]
    );

    if (!updated.rows[0]) {
      res.status(404).json({ error: 'EQUIPMENT_NOT_FOUND' });
      return;
    }

    await recordAuditEvent({
      actorId: req.user!.sub,
      action: 'EQUIPMENT_ITEM_UPDATED',
      targetEntity: 'equipment_items',
      targetId: itemId,
      details: { condition, total_units, daily_price, active },
    });

    res.status(200).json({ item: updated.rows[0] });
  }
);

adminRouter.patch(
  '/rentals/:rentalId/status',
  async (req: Request, res: Response): Promise<void> => {
    const rentalId = String(req.params.rentalId || '');
    const status = req.body?.status as 'confirmed' | 'out' | 'returned' | 'cancelled';

    if (!['confirmed', 'out', 'returned', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'INVALID_RENTAL_STATUS' });
      return;
    }

    const updated = await query(
      `UPDATE rentals
       SET status = $1, held_until = NULL
       WHERE id = $2
       RETURNING *`,
      [status, rentalId]
    );

    if (!updated.rows[0]) {
      res.status(404).json({ error: 'RENTAL_NOT_FOUND' });
      return;
    }

    await recordAuditEvent({
      actorId: req.user!.sub,
      action: `RENTAL_MARKED_${status.toUpperCase()}`,
      targetEntity: 'rentals',
      targetId: rentalId,
      details: { status },
    });

    res.status(200).json({ rental: updated.rows[0] });
  }
);

// ============================================================================
// 5. DYNAMIC PRICING, PACKAGES & WATERMARK CONFIGURATION (AD-06, AD-09)
// ============================================================================
adminRouter.put('/settings/pricing', async (req: Request, res: Response): Promise<void> => {
  const { deposit_percentage, photographer_commission_rate } = req.body as {
    deposit_percentage: number;
    photographer_commission_rate: number;
  };

  const value = {
    deposit_percentage: Math.min(100, Math.max(10, Number(deposit_percentage))),
    photographer_commission_rate: Math.min(
      90,
      Math.max(0, Number(photographer_commission_rate))
    ),
  };

  await query(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at)
     VALUES ('pricing_config', $1::jsonb, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [JSON.stringify(value), req.user!.sub]
  );

  await recordAuditEvent({
    actorId: req.user!.sub,
    action: 'PRICING_CONFIG_UPDATED',
    targetEntity: 'platform_settings',
    details: value,
  });

  res.status(200).json({ pricingConfig: value });
});

adminRouter.patch(
  '/packages/:packageId',
  async (req: Request, res: Response): Promise<void> => {
    const packageId = String(req.params.packageId || '');
    const { name, description, price_per_picture, turnaround_hours, free_revisions, active } =
      req.body;

    const updated = await query(
      `UPDATE edit_packages
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           price_per_picture = COALESCE($3, price_per_picture),
           turnaround_hours = COALESCE($4, turnaround_hours),
           free_revisions = COALESCE($5, free_revisions),
           active = COALESCE($6, active)
       WHERE id = $7
       RETURNING *`,
      [
        name ?? null,
        description ?? null,
        price_per_picture !== undefined ? String(price_per_picture) : null,
        turnaround_hours !== undefined ? Number(turnaround_hours) : null,
        free_revisions !== undefined ? Number(free_revisions) : null,
        active !== undefined ? Boolean(active) : null,
        packageId,
      ]
    );

    await recordAuditEvent({
      actorId: req.user!.sub,
      action: 'EDIT_PACKAGE_UPDATED',
      targetEntity: 'edit_packages',
      targetId: packageId,
      details: { price_per_picture, turnaround_hours, free_revisions, active },
    });

    res.status(200).json({ package: updated.rows[0] });
  }
);

adminRouter.put(
  '/settings/watermark',
  async (req: Request, res: Response): Promise<void> => {
    const { opacity, scale_ratio } = req.body as {
      opacity: number;
      scale_ratio?: number;
    };

    const updated = await query(
      `UPDATE platform_settings
       SET value = value || $1::jsonb,
           updated_by = $2,
           updated_at = NOW()
       WHERE key = 'watermark_config'
       RETURNING value`,
      [
        JSON.stringify({
          opacity: Math.min(1, Math.max(0.1, Number(opacity ?? 0.45))),
          scale_ratio: Math.min(0.8, Math.max(0.15, Number(scale_ratio ?? 0.35))),
        }),
        req.user!.sub,
      ]
    );

    await recordAuditEvent({
      actorId: req.user!.sub,
      action: 'WATERMARK_CONFIG_UPDATED',
      targetEntity: 'platform_settings',
      details: { opacity, scale_ratio },
    });

    res.status(200).json({ watermarkConfig: updated.rows[0]?.value });
  }
);

// ============================================================================
// 6. USER MANAGEMENT (AD-08) & BOOKINGS VIEW (AD-03)
// ============================================================================
adminRouter.get('/users', async (_req: Request, res: Response): Promise<void> => {
  const usersRes = await query(
    `SELECT id, email, role, phone, full_name, two_factor_enabled, status, email_verified_at, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  res.status(200).json({ users: usersRes.rows });
});

adminRouter.patch('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = String(req.params.userId || '');
    if (!UUID_REGEX.test(userId)) {
      res.status(400).json({ error: 'INVALID_USER_ID', message: 'Invalid user ID.' });
      return;
    }
    const { role, status, verify_email } = req.body as {
      role?: string;
      status?: string;
      verify_email?: boolean;
    };

    if (role === 'photographer') {
      res.status(403).json({
        error: 'PHOTOGRAPHER_ROLE_LOCKED',
        message:
          'Direct upgrade to photographer is disabled. Photographers must register via the dedicated photographer signup flow with proof-of-work verification.',
      });
      return;
    }

    const updated = await query(
      `UPDATE users
       SET role = COALESCE($1::varchar, role),
           status = COALESCE($2::varchar, status),
           email_verified_at = CASE WHEN $3::boolean = true THEN COALESCE(email_verified_at, NOW()) ELSE email_verified_at END,
           updated_at = NOW()
       WHERE id = $4::uuid
       RETURNING id, email, role, phone, full_name, status, email_verified_at, created_at`,
      [role ?? null, status ?? null, Boolean(verify_email), userId]
    );

    const targetUser = updated.rows[0];
    if (!targetUser) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User account not found.' });
      return;
    }

    if (role && targetUser) {
      const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || 'https://icxora.com').replace(/\/$/, '');
      const portalUrl =
        role === 'editor'
          ? `${webUrl}/workspace/editor`
          : role === 'admin'
          ? `${webUrl}/admin`
          : `${webUrl}/dashboard`;

      const roleName =
        role === 'editor'
          ? 'Senior Retoucher'
          : role === 'admin'
          ? 'Administrator'
          : 'Client';

      void dispatchNotification({
        triggerId: 'NT-ROLE-UPGRADE',
        recipientEmail: targetUser.email,
        recipientUserId: targetUser.id,
        subject: `Your ICX Studios Account Has Been Upgraded to ${roleName}`,
        htmlBody: buildStudioEmailTemplate({
          heading: 'Account Status Upgraded',
          subheading: `Your account role has been elevated to ${roleName}.`,
          bodyHtml: `
            <p style="margin:0 0 14px;">Hello ${targetUser.full_name},</p>
            <p style="margin:0 0 14px;">An administrator has upgraded your ICX Studios account permissions to <strong>${roleName}</strong>.</p>
            <p style="margin:0 0 14px;">You now have full access to your specialized studio workspace, tools, and operational features.</p>
          `,
          ctaLabel: 'Access Your Studio Workspace',
          ctaUrl: portalUrl,
          footerNote: 'If you have any questions about your account permissions, please contact support@icxora.com.',
        }),
        targetEntity: 'users',
        targetId: targetUser.id,
      }).catch((err) => {
        console.error('[ICX-ADMIN] Failed to send upgrade notification:', err);
      });
    }

    await recordAuditEvent({
      actorId: req.user!.sub,
      action: 'ADMIN_USER_MODIFIED',
      targetEntity: 'users',
      targetId: userId,
      details: { role, status, verify_email },
    });

    res.status(200).json({ user: targetUser });
  } catch (err) {
    console.error('[ICX-ADMIN] User update failed:', err);
    res.status(500).json({
      error: 'USER_UPDATE_FAILED',
      message: err instanceof Error ? err.message : 'Unable to update user account.',
    });
  }
});

adminRouter.get('/users/:userId/details', async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId || '');
  if (!UUID_REGEX.test(userId)) {
    res.status(400).json({ error: 'INVALID_USER_ID', message: 'Invalid user UUID.' });
    return;
  }
  const userRes = await query(
    `SELECT id, email, role, phone, full_name, two_factor_enabled, status, email_verified_at, created_at, updated_at
     FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const targetUser = userRes.rows[0];
  if (!targetUser) {
    res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User does not exist.' });
    return;
  }

  const [ordersRes, bookingsRes, rentalsRes, photogRes, paymentsRes] = await Promise.all([
    query(
      `SELECT id, status, picture_count, total_amount, amount_paid, balance_amount, payment_state, created_at
       FROM edit_orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 25`,
      [userId]
    ),
    query(
      `SELECT b.id, b.service_title, b.price, b.status, b.booking_date, b.package_type, b.time_period, s.start_time, s.end_time, b.created_at
       FROM bookings b
       LEFT JOIN availability_slots s ON s.id = b.slot_id
       LEFT JOIN photographer_profiles pp ON pp.id = b.photographer_id
       WHERE b.customer_id = $1 OR pp.user_id = $1
       ORDER BY b.created_at DESC LIMIT 25`,
      [userId]
    ),
    query(
      `SELECT r.id, r.start_date, r.end_date, r.status, r.total_amount, ei.name as item_name
       FROM rentals r
       JOIN equipment_items ei ON ei.id = r.item_id
       WHERE r.customer_id = $1 ORDER BY r.start_date DESC LIMIT 25`,
      [userId]
    ),
    query(
      `SELECT * FROM photographer_profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    ),
    query(
      `SELECT id, amount, type, gateway_reference, target_type, verified_at as created_at
       FROM payments
       WHERE target_id = $1
          OR target_id IN (SELECT id FROM edit_orders WHERE customer_id = $1)
          OR target_id IN (SELECT id FROM bookings WHERE customer_id = $1)
          OR target_id IN (SELECT id FROM rentals WHERE customer_id = $1)
       ORDER BY verified_at DESC LIMIT 25`,
      [userId]
    ),
  ]);

  res.status(200).json({
    user: targetUser,
    orders: ordersRes.rows,
    bookings: bookingsRes.rows,
    rentals: rentalsRes.rows,
    photographerProfile: photogRes.rows[0] || null,
    payments: paymentsRes.rows,
  });
});

adminRouter.post('/users/:userId/impersonate', async (req: Request, res: Response): Promise<void> => {
  const userId = String(req.params.userId || '');
  const userRes = await query<{
    id: string;
    email: string;
    role: any;
    full_name: string;
    status: string;
    email_verified_at: Date | null;
  }>(
    `SELECT id, email, role, full_name, status, email_verified_at FROM users WHERE id = $1 LIMIT 1`,
    [userId]
  );
  const targetUser = userRes.rows[0];
  if (!targetUser) {
    res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Target user does not exist.' });
    return;
  }

  await recordAuditEvent({
    actorId: req.user!.sub,
    action: 'ADMIN_IMPERSONATED_USER',
    targetEntity: 'users',
    targetId: targetUser.id,
    details: {
      adminEmail: req.user!.email,
      targetEmail: targetUser.email,
      targetRole: targetUser.role,
    },
  });

  const { accessToken } = await issueTokenPair(targetUser);

  res.status(200).json({
    user: targetUser,
    accessToken,
  });
});

adminRouter.get('/bookings', async (_req: Request, res: Response): Promise<void> => {
  const bookingsRes = await query(`
    SELECT b.*,
           cu.full_name AS customer_name,
           cu.email AS customer_email,
           pu.full_name AS photographer_name,
           s.start_time,
           s.end_time
    FROM bookings b
    JOIN users cu ON cu.id = b.customer_id
    JOIN photographer_profiles pp ON pp.id = b.photographer_id
    JOIN users pu ON pu.id = pp.user_id
    JOIN availability_slots s ON s.id = b.slot_id
    ORDER BY b.created_at DESC
  `);
  res.status(200).json({ bookings: bookingsRes.rows });
});

// ============================================================================
// 7. PAYMENTS LEDGER, AUDIT LOGS & CSV EXPORTS (AD-07, AD-10)
// ============================================================================
adminRouter.get('/payments', async (req: Request, res: Response): Promise<void> => {
  const format = String(req.query.format || 'json');
  const paymentsRes = await query(`
    SELECT p.*
    FROM payments p
    ORDER BY p.verified_at DESC
    LIMIT 1000
  `);

  if (format === 'csv') {
    const header = 'id,target_type,target_id,type,amount_kobo,amount_ngn,gateway_reference,verified_at\n';
    const rows = paymentsRes.rows
      .map(
        (r) =>
          `${r.id},${r.target_type},${r.target_id},${r.type},${r.amount},${(Number(r.amount) / 100).toFixed(2)},${r.gateway_reference},${new Date(r.verified_at).toISOString()}`
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="icx_payments_ledger.csv"');
    res.status(200).send(header + rows);
    return;
  }

  res.status(200).json({ payments: paymentsRes.rows });
});

adminRouter.get('/audit-logs', async (req: Request, res: Response): Promise<void> => {
  const format = String(req.query.format || 'json');
  const logsRes = await query(`
    SELECT ae.*, u.email AS actor_email, u.role AS actor_role
    FROM audit_events ae
    LEFT JOIN users u ON u.id = ae.actor_id
    ORDER BY ae.created_at DESC
    LIMIT 1000
  `);

  if (format === 'csv') {
    const header = 'id,actor_id,actor_email,actor_role,action,target_entity,target_id,created_at\n';
    const rows = logsRes.rows
      .map(
        (r) =>
          `${r.id},${r.actor_id || ''},${r.actor_email || ''},${r.actor_role || ''},${r.action},${r.target_entity},${r.target_id || ''},${new Date(r.created_at).toISOString()}`
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="icx_audit_events.csv"');
    res.status(200).send(header + rows);
    return;
  }

  res.status(200).json({ auditLogs: logsRes.rows });
});

