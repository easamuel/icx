import { Router, type Request, type Response } from 'express';
import {
  CreateEditOrderSchema,
  CreateRevisionRequestSchema,
  type EditPackageRecord,
  type EditOrderRecord,
  type PhotoRecord,
  type RevisionRequestRecord,
} from '@icx/shared-types';
import { query, withTransaction, recordAuditEvent } from '@icx/database';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { dispatchNotification } from '../engines/notification.engine.js';

export const editingRouter = Router();

// ============================================================================
// GET /api/v1/editing/packages (PE-01, PE-03, PE-04, AD-06)
// Returns active editing packages + current admin-configured deposit percentage.
// ============================================================================
editingRouter.get('/packages', async (_req: Request, res: Response): Promise<void> => {
  const pkgRes = await query<EditPackageRecord>(
    'SELECT * FROM edit_packages WHERE active = true ORDER BY price_per_picture ASC'
  );
  const settingsRes = await query<{ value: { deposit_percentage?: number } }>(
    "SELECT value FROM platform_settings WHERE key = 'pricing_config' LIMIT 1"
  );

  res.status(200).json({
    packages: pkgRes.rows,
    depositPercentage: Number(settingsRes.rows[0]?.value?.deposit_percentage ?? 70),
  });
});

// ============================================================================
// POST /api/v1/editing/orders (PE-01, PE-03, PE-04)
// Creates a new editing order in 'awaiting_payment' status.
// ============================================================================
editingRouter.post(
  '/orders',
  requireAuth,
  requireRole('customer', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateEditOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { package_id, picture_count, payment_option, customer_notes } = parsed.data;

    try {
      const pkgRes = await query<EditPackageRecord>(
        'SELECT * FROM edit_packages WHERE id = $1 AND active = true LIMIT 1',
        [package_id]
      );
      const pkg = pkgRes.rows[0];
      if (!pkg) {
        res.status(404).json({
          error: 'PACKAGE_NOT_FOUND',
          message: 'Selected editing package is not available.',
        });
        return;
      }

      const settingsRes = await query<{ value: { deposit_percentage?: number } }>(
        "SELECT value FROM platform_settings WHERE key = 'pricing_config' LIMIT 1"
      );
      const depositPercentage = Number(
        settingsRes.rows[0]?.value?.deposit_percentage ?? 70
      );

      // PE-03: Order total = package price * number of pictures
      const totalAmount = BigInt(pkg.price_per_picture) * BigInt(picture_count);
      const initialCheckoutAmount =
        payment_option === 'deposit'
          ? (totalAmount * BigInt(Math.round(depositPercentage))) / 100n
          : totalAmount;

      const orderRes = await query<EditOrderRecord>(
        `INSERT INTO edit_orders (
           customer_id, package_id, picture_count, total_amount,
           amount_paid, balance_amount, payment_state, status, customer_notes
         )
         VALUES ($1, $2, $3, $4, 0, $4, 'unpaid', 'awaiting_payment', $5)
         RETURNING *`,
        [
          req.user!.sub,
          pkg.id,
          picture_count,
          totalAmount.toString(),
          customer_notes ?? null,
        ]
      );

      const order = orderRes.rows[0]!;

      await recordAuditEvent({
        actorId: req.user!.sub,
        action: 'EDIT_ORDER_CREATED',
        targetEntity: 'edit_orders',
        targetId: order.id,
        details: {
          packageId: pkg.id,
          pictureCount: picture_count,
          totalAmount: totalAmount.toString(),
          paymentOption: payment_option,
        },
      });

      res.status(201).json({
        order,
        package: pkg,
        checkoutSummary: {
          paymentOption: payment_option,
          depositPercentage,
          totalAmountKobo: totalAmount.toString(),
          dueNowKobo: initialCheckoutAmount.toString(),
          remainingBalanceKobo: (totalAmount - initialCheckoutAmount).toString(),
        },
      });
    } catch (error) {
      console.error('[ICX-EDITING] Order creation error:', error);
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
);

// ============================================================================
// GET /api/v1/editing/orders (AC-08)
// Lists customer's own edit orders (strict row ownership enforced on server NF-07).
// ============================================================================
editingRouter.get(
  '/orders',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const ordersRes = await query<
      EditOrderRecord & { package_name: string; photo_count_uploaded: string }
    >(
      `SELECT eo.*,
              ep.name AS package_name,
              ep.free_revisions,
              (SELECT COUNT(*) FROM photos p WHERE p.order_id = eo.id)::text AS photo_count_uploaded
       FROM edit_orders eo
       JOIN edit_packages ep ON ep.id = eo.package_id
       WHERE eo.customer_id = $1
       ORDER BY eo.created_at DESC`,
      [req.user!.sub]
    );

    res.status(200).json({ orders: ordersRes.rows });
  }
);

// ============================================================================
// GET /api/v1/editing/orders/:orderId (PE-06, PE-07, NF-01)
// Returns order details, watermarked preview URLs, and revision history.
// NEVER exposes raw original_storage_key or edited_storage_key to the client!
// ============================================================================
editingRouter.get(
  '/orders/:orderId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const orderId = String(req.params.orderId || '');
    const orderRes = await query<
      EditOrderRecord & {
        package_name: string;
        free_revisions: number;
        turnaround_hours: number;
      }
    >(
      `SELECT eo.*, ep.name AS package_name, ep.free_revisions, ep.turnaround_hours
       FROM edit_orders eo
       JOIN edit_packages ep ON ep.id = eo.package_id
       WHERE eo.id = $1
       LIMIT 1`,
      [orderId]
    );

    const order = orderRes.rows[0];
    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND' });
      return;
    }

    if (order.customer_id !== req.user!.sub && req.user!.role !== 'admin') {
      res.status(403).json({
        error: 'FORBIDDEN_ORDER',
        message: 'You do not have permission to view this order.',
      });
      return;
    }

    const photosRes = await query<PhotoRecord>(
      'SELECT id, order_id, version, created_at, (edited_storage_key IS NOT NULL) AS has_edit, (preview_storage_key IS NOT NULL) AS has_preview FROM photos WHERE order_id = $1 ORDER BY created_at ASC',
      [order.id]
    );

    const revisionsRes = await query<RevisionRequestRecord>(
      `SELECT rr.*
       FROM revision_requests rr
       JOIN photos p ON p.id = rr.photo_id
       WHERE p.order_id = $1
       ORDER BY rr.requested_at DESC`,
      [order.id]
    );

    // Map safe preview streaming endpoints (never exposing private disk paths)
    const safePhotos = photosRes.rows.map((p) => ({
      id: p.id,
      order_id: p.order_id,
      version: p.version,
      created_at: p.created_at,
      hasEdit: Boolean((p as unknown as { has_edit: boolean }).has_edit),
      hasPreview: Boolean((p as unknown as { has_preview: boolean }).has_preview),
      beforePreviewUrl: `/api/v1/uploads/preview/${p.id}?variant=before`,
      afterPreviewUrl: `/api/v1/uploads/preview/${p.id}?variant=edit`,
      revisions: revisionsRes.rows.filter((r) => r.photo_id === p.id),
    }));

    res.status(200).json({
      order,
      photos: safePhotos,
      canDownloadClean: order.payment_state === 'fully_paid',
    });
  }
);

// ============================================================================
// POST /api/v1/editing/orders/:orderId/revisions (PE-08)
// Requests a revision on a specific photo up to the package's free_revisions limit.
// ============================================================================
editingRouter.post(
  '/orders/:orderId/revisions',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const orderId = String(req.params.orderId || '');
    const parsed = CreateRevisionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: parsed.error.flatten(),
      });
      return;
    }

    const { photo_id, notes } = parsed.data;

    try {
      const result = await withTransaction(async (client) => {
        const orderRes = await client.query<
          EditOrderRecord & { free_revisions: number }
        >(
          `SELECT eo.*, ep.free_revisions
           FROM edit_orders eo
           JOIN edit_packages ep ON ep.id = eo.package_id
           WHERE eo.id = $1
           FOR UPDATE OF eo`,
          [orderId]
        );

        const order = orderRes.rows[0];
        if (!order) {
          return { status: 404 as const, body: { error: 'ORDER_NOT_FOUND' } };
        }

        if (order.customer_id !== req.user!.sub && req.user!.role !== 'admin') {
          return { status: 403 as const, body: { error: 'FORBIDDEN_ORDER' } };
        }

        const photoRes = await client.query<PhotoRecord>(
          'SELECT * FROM photos WHERE id = $1 AND order_id = $2 LIMIT 1',
          [photo_id, orderId]
        );
        if (!photoRes.rows[0]) {
          return { status: 404 as const, body: { error: 'PHOTO_NOT_FOUND' } };
        }

        const revCountRes = await client.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM revision_requests WHERE photo_id = $1',
          [photo_id]
        );
        const usedRevisions = Number(revCountRes.rows[0]?.count ?? 0);

        if (usedRevisions >= order.free_revisions) {
          return {
            status: 400 as const,
            body: {
              error: 'FREE_REVISIONS_EXHAUSTED',
              message: `This package includes ${order.free_revisions} free revision(s) per photo, which have already been used.`,
            },
          };
        }

        const insertRev = await client.query<RevisionRequestRecord>(
          `INSERT INTO revision_requests (photo_id, customer_id, notes)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [photo_id, req.user!.sub, notes]
        );

        // Loop status back to revision -> in_editing
        await client.query(
          `UPDATE edit_orders
           SET status = 'revision'
           WHERE id = $1`,
          [orderId]
        );

        await recordAuditEvent(
          {
            actorId: req.user!.sub,
            action: 'PHOTO_REVISION_REQUESTED',
            targetEntity: 'revision_requests',
            targetId: insertRev.rows[0]!.id,
            details: { orderId, photoId: photo_id, usedRevisions: usedRevisions + 1 },
          },
          client
        );

        return {
          status: 201 as const,
          body: {
            revision: insertRev.rows[0]!,
            remainingFreeRevisions: order.free_revisions - (usedRevisions + 1),
          },
          assigneeId: order.assignee_id,
        };
      });

      if (result.status === 201 && result.assigneeId) {
        const editorRes = await query<{ email: string }>(
          'SELECT email FROM users WHERE id = $1 LIMIT 1',
          [result.assigneeId]
        );
        if (editorRes.rows[0]?.email) {
          await dispatchNotification({
            triggerId: 'NT-05',
            recipientEmail: editorRes.rows[0].email,
            recipientUserId: result.assigneeId,
            subject: `Revision Requested on Order #${orderId.slice(0, 8)}`,
            htmlBody: `<p>A customer has requested a photo revision: <em>"${notes}"</em></p>`,
            targetEntity: 'edit_orders',
            targetId: orderId,
          });
        }
      }

      res.status(result.status).json(result.body);
    } catch (error) {
      console.error('[ICX-EDITING] Revision request error:', error);
      res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
    }
  }
);

