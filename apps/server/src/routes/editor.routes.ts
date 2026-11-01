import { Router, type Request, type Response } from 'express';
import { query, recordAuditEvent } from '@icx/database';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const editorRouter = Router();

// All Editor Workspace routes strictly require 'editor' or 'admin' role (AC-07)
editorRouter.use(requireAuth, requireRole('editor', 'admin'));

// ============================================================================
// 1. GET /api/v1/editor/jobs (Section 4 Editor Workspace & Privacy Rule)
// Strictly strips all customer contact details (name, email, phone) and
// billing/payment fields (`total_amount`, `amount_paid`, `balance_amount`, `payment_state`).
// ============================================================================
editorRouter.get('/jobs', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.sub;
  const isAdmin = req.user!.role === 'admin';

  const jobsRes = await query(
    `SELECT
       eo.id,
       eo.package_id,
       ep.name AS package_name,
       ep.description AS package_description,
       ep.turnaround_hours,
       ep.free_revisions,
       eo.picture_count,
       eo.status,
       eo.assignee_id,
       eo.customer_notes,
       eo.due_at,
       eo.created_at,
       (SELECT COUNT(*) FROM photos p WHERE p.order_id = eo.id)::int AS uploaded_count,
       (SELECT COUNT(*) FROM photos p WHERE p.order_id = eo.id AND p.edited_storage_key IS NOT NULL)::int AS edited_count,
       (SELECT COUNT(*) FROM revision_requests rr JOIN photos p ON p.id = rr.photo_id WHERE p.order_id = eo.id AND rr.resolved_at IS NULL)::int AS open_revisions_count
     FROM edit_orders eo
     JOIN edit_packages ep ON ep.id = eo.package_id
     WHERE eo.status IN ('in_queue', 'in_editing', 'revision', 'ready_for_review')
       AND ($1 = true OR eo.assignee_id = $2 OR eo.assignee_id IS NULL)
     ORDER BY
       CASE WHEN eo.status = 'revision' THEN 0 WHEN eo.status = 'in_editing' THEN 1 ELSE 2 END,
       eo.due_at ASC NULLS LAST`,
    [isAdmin, userId]
  );

  res.status(200).json({ jobs: jobsRes.rows });
});

// ============================================================================
// 2. GET /api/v1/editor/jobs/:orderId
// Returns job package specs, photos, original download links, and revision notes.
// Zero customer contact or financial columns are ever selected.
// ============================================================================
editorRouter.get('/jobs/:orderId', async (req: Request, res: Response): Promise<void> => {
  const orderId = String(req.params.orderId || '');
  const userId = req.user!.sub;
  const isAdmin = req.user!.role === 'admin';

  const jobRes = await query(
    `SELECT
       eo.id,
       eo.package_id,
       ep.name AS package_name,
       ep.description AS package_description,
       ep.turnaround_hours,
       ep.free_revisions,
       eo.picture_count,
       eo.status,
       eo.assignee_id,
       eo.customer_notes,
       eo.due_at,
       eo.created_at
     FROM edit_orders eo
     JOIN edit_packages ep ON ep.id = eo.package_id
     WHERE eo.id = $1
       AND ($2 = true OR eo.assignee_id = $3 OR eo.assignee_id IS NULL)
     LIMIT 1`,
    [orderId, isAdmin, userId]
  );

  const job = jobRes.rows[0];
  if (!job) {
    res.status(404).json({ error: 'JOB_NOT_FOUND_OR_UNASSIGNED' });
    return;
  }

  const photosRes = await query(
    `SELECT
       p.id,
       p.order_id,
       p.version,
       p.created_at,
       (p.edited_storage_key IS NOT NULL) AS has_edit,
       (p.preview_storage_key IS NOT NULL) AS has_preview
     FROM photos p
     WHERE p.order_id = $1
     ORDER BY p.created_at ASC`,
    [orderId]
  );

  const revisionsRes = await query(
    `SELECT rr.id, rr.photo_id, rr.notes, rr.requested_at, rr.resolved_at
     FROM revision_requests rr
     JOIN photos p ON p.id = rr.photo_id
     WHERE p.order_id = $1
     ORDER BY rr.requested_at DESC`,
    [orderId]
  );

  res.status(200).json({
    job,
    photos: photosRes.rows.map((p) => ({
      ...p,
      originalDownloadUrl: `/api/v1/uploads/editor-original/${p.id}`,
      previewUrl: `/api/v1/uploads/preview/${p.id}`,
      revisions: revisionsRes.rows.filter((r) => r.photo_id === p.id),
    })),
  });
});

// ============================================================================
// 3. POST /api/v1/editor/jobs/:orderId/claim
// Allows an editor or admin to claim an unassigned job in 'in_queue' and start editing.
// ============================================================================
editorRouter.post(
  '/jobs/:orderId/claim',
  async (req: Request, res: Response): Promise<void> => {
    const orderId = String(req.params.orderId || '');
    const userId = req.user!.sub;

    const updated = await query(
      `UPDATE edit_orders
       SET assignee_id = $1,
           status = CASE WHEN status = 'in_queue' THEN 'in_editing' ELSE status END
       WHERE id = $2
         AND (assignee_id IS NULL OR assignee_id = $1 OR $3 = 'admin')
       RETURNING id, status, assignee_id`,
      [userId, orderId, req.user!.role]
    );

    if (!updated.rows[0]) {
      res.status(409).json({
        error: 'JOB_ALREADY_ASSIGNED',
        message: 'This editing job has already been assigned to another editor.',
      });
      return;
    }

    await recordAuditEvent({
      actorId: userId,
      action: 'EDITOR_CLAIMED_JOB',
      targetEntity: 'edit_orders',
      targetId: orderId,
    });

    res.status(200).json({ job: updated.rows[0] });
  }
);

