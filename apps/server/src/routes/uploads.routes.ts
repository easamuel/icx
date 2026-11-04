import { Router, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';
import { query, recordAuditEvent } from '@icx/database';
import type { PhotoRecord, EditOrderRecord, BookingRecord } from '@icx/shared-types';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import {
  handleTusOptions,
  handleTusCreate,
  handleTusHead,
  handleTusPatch,
  finalizeCompletedUpload,
} from '../engines/tus.engine.js';
import {
  streamPrivateFile,
  streamCompiledZip,
} from '../engines/storage.engine.js';
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from '../lib/jwt.js';
import { env } from '../config/env.js';

export const uploadsRouter = Router();

// ============================================================================
// 1. TUS RESUMABLE UPLOAD PROTOCOL ENDPOINTS (PE-02, NF-12)
// ============================================================================
uploadsRouter.options('/tus', handleTusOptions);
uploadsRouter.options('/tus/:uploadId', handleTusOptions);

uploadsRouter.post(
  '/tus',
  requireAuth,
  rateLimiter({ scope: 'tus_create', windowSeconds: 60, maxRequests: 120 }),
  handleTusCreate
);

uploadsRouter.head('/tus/:uploadId', requireAuth, handleTusHead);

uploadsRouter.patch(
  '/tus/:uploadId',
  requireAuth,
  rateLimiter({ scope: 'tus_patch', windowSeconds: 60, maxRequests: 600 }),
  handleTusPatch
);

// ============================================================================
// 2. DIRECT BASE64 / BUFFER UPLOAD ENDPOINT (Convenience for small assets/edits)
// ============================================================================
uploadsRouter.post(
  '/direct',
  requireAuth,
  rateLimiter({ scope: 'direct_upload', windowSeconds: 60, maxRequests: 60 }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { uploadType, targetId, photoId, filename, filetype, base64Data } =
        req.body as {
          uploadType: 'order_original' | 'editor_edit' | 'booking_delivery' | 'watermark_asset';
          targetId: string;
          photoId?: string;
          filename: string;
          filetype: string;
          base64Data: string;
        };

      if (!uploadType || !targetId || !base64Data) {
        res.status(400).json({
          error: 'MISSING_UPLOAD_FIELDS',
          message: 'uploadType, targetId, and base64Data are required.',
        });
        return;
      }

      if (uploadType === 'editor_edit' && !['editor', 'admin'].includes(req.user!.role)) {
        res.status(403).json({ error: 'FORBIDDEN_ROLE' });
        return;
      }

      if (uploadType === 'watermark_asset' && req.user!.role !== 'admin') {
        res.status(403).json({ error: 'FORBIDDEN_ROLE' });
        return;
      }

      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      if (buffer.byteLength > 50 * 1024 * 1024) {
        res.status(413).json({
          error: 'FILE_TOO_LARGE',
          message: 'File exceeds 50 MB limit.',
        });
        return;
      }

      const stagingDir = path.resolve(process.cwd(), env.TUS_UPLOAD_DIR);
      await fsp.mkdir(stagingDir, { recursive: true });
      const stagingPath = path.join(stagingDir, `direct_${crypto.randomUUID()}.part`);
      await fsp.writeFile(stagingPath, buffer);

      const finalized = await finalizeCompletedUpload(
        {
          uploadId: crypto.randomUUID(),
          userId: req.user!.sub,
          userRole: req.user!.role,
          uploadType,
          targetId,
          photoId,
          filename: filename || 'upload.jpg',
          filetype: filetype || 'image/jpeg',
          uploadLength: buffer.byteLength,
          offset: buffer.byteLength,
          createdAt: new Date().toISOString(),
        },
        stagingPath
      );

      res.status(201).json({ status: 'uploaded', result: finalized });
    } catch (error) {
      res.status(422).json({
        error: 'UPLOAD_FAILED',
        message: error instanceof Error ? error.message : 'Upload processing failed.',
      });
    }
  }
);

// ============================================================================
// 3. WATERMARKED PREVIEW STREAMING (NF-01, NF-02, PE-06, PE-07)
// Never serves un-watermarked originals or clean edits!
// ============================================================================
uploadsRouter.get(
  '/preview/:photoId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const photoId = String(req.params.photoId || '');
    const variant = String(req.query.variant || 'edit'); // 'edit' | 'before'

    const photoRes = await query<
      PhotoRecord & {
        order_customer_id: string | null;
        order_assignee_id: string | null;
        booking_customer_id: string | null;
        booking_photographer_user_id: string | null;
      }
    >(
      `SELECT p.*,
              eo.customer_id AS order_customer_id,
              eo.assignee_id AS order_assignee_id,
              b.customer_id AS booking_customer_id,
              pp.user_id AS booking_photographer_user_id
       FROM photos p
       LEFT JOIN edit_orders eo ON eo.id = p.order_id
       LEFT JOIN bookings b ON b.id = p.booking_id
       LEFT JOIN photographer_profiles pp ON pp.id = b.photographer_id
       WHERE p.id = $1
       LIMIT 1`,
      [photoId]
    );

    const photo = photoRes.rows[0];
    if (!photo) {
      res.status(404).json({ error: 'PHOTO_NOT_FOUND' });
      return;
    }

    const userId = req.user!.sub;
    const userRole = req.user!.role;

    const isAuthorized =
      userRole === 'admin' ||
      photo.order_customer_id === userId ||
      photo.order_assignee_id === userId ||
      photo.booking_customer_id === userId ||
      photo.booking_photographer_user_id === userId;

    if (!isAuthorized) {
      res.status(403).json({
        error: 'FORBIDDEN_RESOURCE',
        message: 'You do not have permission to view this preview.',
      });
      return;
    }

    if (!photo.preview_storage_key) {
      res.status(404).json({
        error: 'PREVIEW_NOT_READY',
        message: 'Watermarked preview is still being generated.',
      });
      return;
    }

    // If customer requests the 'before' slider image, look for the watermarked original preview
    if (variant === 'before' && photo.order_id) {
      const origBasename = path
        .basename(photo.original_storage_key)
        .replace(/\.[^.]+$/, '.jpg');
      const beforePreviewKey = `previews/orders/${photo.order_id}/orig_preview_${origBasename}`;
      await streamPrivateFile(beforePreviewKey, res);
      return;
    }

    await streamPrivateFile(photo.preview_storage_key, res);
  }
);

// ============================================================================
// 4. EDITOR / ADMIN ORIGINAL DOWNLOAD (Restricted strictly to Editor & Admin)
// ============================================================================
uploadsRouter.get(
  '/editor-original/:photoId',
  requireAuth,
  requireRole('editor', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const photoId = String(req.params.photoId || '');
    const photoRes = await query<PhotoRecord & { assignee_id: string | null }>(
      `SELECT p.*, eo.assignee_id
       FROM photos p
       LEFT JOIN edit_orders eo ON eo.id = p.order_id
       WHERE p.id = $1
       LIMIT 1`,
      [photoId]
    );

    const photo = photoRes.rows[0];
    if (!photo) {
      res.status(404).json({ error: 'PHOTO_NOT_FOUND' });
      return;
    }

    if (
      req.user!.role === 'editor' &&
      photo.assignee_id &&
      photo.assignee_id !== req.user!.sub
    ) {
      res.status(403).json({
        error: 'FORBIDDEN_JOB',
        message: 'This editing job is not assigned to your editor account.',
      });
      return;
    }

    await streamPrivateFile(photo.original_storage_key, res, {
      asDownload: true,
      downloadFilename: `icx_original_${photo.id}${path.extname(photo.original_storage_key)}`,
    });
  }
);

// ============================================================================
// 5. EXPIRING 24-HOUR CLEAN DOWNLOAD GENERATOR (Requirement PE-10, NF-01)
// Strictly verifies payment_state = 'fully_paid' in PostgreSQL before signing!
// ============================================================================
uploadsRouter.post(
  '/clean-link',
  requireAuth,
  rateLimiter({ scope: 'download_link', windowSeconds: 60, maxRequests: 30 }),
  async (req: Request, res: Response): Promise<void> => {
    const { targetType, targetId, photoId } = req.body as {
      targetType: 'edit_order' | 'booking';
      targetId: string;
      photoId?: string | 'zip';
    };

    if (!targetType || !targetId) {
      res.status(400).json({ error: 'MISSING_PARAMETERS' });
      return;
    }

    const userId = req.user!.sub;
    const isAdmin = req.user!.role === 'admin';

    if (targetType === 'edit_order') {
      const orderRes = await query<EditOrderRecord>(
        'SELECT * FROM edit_orders WHERE id = $1 LIMIT 1',
        [targetId]
      );
      const order = orderRes.rows[0];

      if (!order) {
        res.status(404).json({ error: 'ORDER_NOT_FOUND' });
        return;
      }

      if (order.customer_id !== userId && !isAdmin) {
        res.status(403).json({
          error: 'FORBIDDEN_ORDER_ACCESS',
          message: 'You cannot access another customer’s order.',
        });
        return;
      }

      // STRICT PAYMENT GATE: Never allow clean file link unless payment_state = 'fully_paid'
      if (order.payment_state !== 'fully_paid') {
        await recordAuditEvent({
          actorId: userId,
          action: 'BLOCKED_UNPAID_CLEAN_DOWNLOAD_ATTEMPT',
          targetEntity: 'edit_orders',
          targetId: order.id,
          details: { payment_state: order.payment_state, photoId },
        });

        res.status(402).json({
          error: 'PAYMENT_REQUIRED_FOR_CLEAN_FILES',
          message:
            'Full payment (100% balance settled via verified webhook) is required before clean files can be unlocked.',
        });
        return;
      }
    } else if (targetType === 'booking') {
      const bookingRes = await query<BookingRecord>(
        'SELECT * FROM bookings WHERE id = $1 LIMIT 1',
        [targetId]
      );
      const booking = bookingRes.rows[0];

      if (!booking) {
        res.status(404).json({ error: 'BOOKING_NOT_FOUND' });
        return;
      }

      if (booking.customer_id !== userId && !isAdmin) {
        res.status(403).json({ error: 'FORBIDDEN_BOOKING_ACCESS' });
        return;
      }

      const paidRes = await query<{ total_paid: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS total_paid
         FROM payments
         WHERE target_type = 'booking' AND target_id = $1 AND type != 'refund'`,
        [booking.id]
      );
      const totalPaid = BigInt(paidRes.rows[0]?.total_paid ?? '0');

      if (
        !['confirmed', 'delivered', 'completed'].includes(booking.status) ||
        totalPaid < BigInt(booking.price)
      ) {
        await recordAuditEvent({
          actorId: userId,
          action: 'BLOCKED_UNPAID_BOOKING_DOWNLOAD_ATTEMPT',
          targetEntity: 'bookings',
          targetId: booking.id,
          details: { status: booking.status, totalPaid: totalPaid.toString() },
        });

        res.status(402).json({
          error: 'PAYMENT_REQUIRED_FOR_CLEAN_FILES',
          message: 'Full booking payment must be confirmed before downloading clean deliverables.',
        });
        return;
      }
    }

    const signed = createSignedDownloadToken({
      userId,
      targetType,
      targetId,
      photoId: photoId || 'zip',
    });

    await recordAuditEvent({
      actorId: userId,
      action: 'CLEAN_DOWNLOAD_LINK_GENERATED',
      targetEntity: targetType,
      targetId,
      details: { photoId: photoId || 'zip', expiresAt: new Date(signed.expiresAt).toISOString() },
    });

    res.status(200).json({
      downloadUrl: `/api/v1/uploads/clean-stream/${signed.token}`,
      token: signed.token,
      expiresAt: new Date(signed.expiresAt).toISOString(),
    });
  }
);

// ============================================================================
// 6. CLEAN FILE / ZIP STREAMING EXECUTOR (Re-verifies HMAC + PostgreSQL payment_state)
// ============================================================================
uploadsRouter.get(
  '/clean-stream/:token',
  rateLimiter({ scope: 'clean_stream', windowSeconds: 60, maxRequests: 30 }),
  async (req: Request, res: Response): Promise<void> => {
    const token = String(req.params.token || '');
    const verified = verifySignedDownloadToken(token);

    if (!verified) {
      res.status(403).json({
        error: 'INVALID_OR_EXPIRED_DOWNLOAD_LINK',
        message: 'This 24-hour download link is invalid or has expired. Please generate a new link from your order page.',
      });
      return;
    }

    // Double-verify payment_state in PostgreSQL at stream time (Defense-in-Depth NF-01)
    if (verified.targetType === 'edit_order') {
      const orderRes = await query<EditOrderRecord>(
        'SELECT * FROM edit_orders WHERE id = $1 LIMIT 1',
        [verified.targetId]
      );
      const order = orderRes.rows[0];
      if (!order || order.payment_state !== 'fully_paid') {
        res.status(402).json({
          error: 'PAYMENT_NOT_COMPLETE',
          message: 'Clean file streaming denied: Order is not fully paid.',
        });
        return;
      }

      const photosRes = await query<PhotoRecord>(
        'SELECT * FROM photos WHERE order_id = $1 ORDER BY created_at ASC',
        [order.id]
      );

      if (verified.photoId === 'zip') {
        const zipItems = photosRes.rows
          .filter((p) => Boolean(p.edited_storage_key || p.original_storage_key))
          .map((p, idx) => {
            const key = p.edited_storage_key || p.original_storage_key;
            const ext = path.extname(key) || '.jpg';
            return {
              storageKey: key,
              archiveName: `ICX_Edit_${idx + 1}_v${p.version}${ext}`,
            };
          });

        await streamCompiledZip(
          zipItems,
          `ICX_Studios_Order_${order.id.slice(0, 8)}_Clean.zip`,
          res
        );
        return;
      }

      const targetPhoto = photosRes.rows.find((p) => p.id === verified.photoId);
      const cleanKey = targetPhoto?.edited_storage_key;
      if (!targetPhoto || !cleanKey) {
        res.status(404).json({ error: 'CLEAN_FILE_NOT_FOUND' });
        return;
      }

      await streamPrivateFile(cleanKey, res, {
        asDownload: true,
        downloadFilename: `ICX_Clean_${targetPhoto.id.slice(0, 8)}_v${targetPhoto.version}${path.extname(cleanKey)}`,
      });
      return;
    }

    if (verified.targetType === 'booking') {
      const paidRes = await query<{ total_paid: string; price: string }>(
        `SELECT
           b.price::text AS price,
           COALESCE((SELECT SUM(amount) FROM payments WHERE target_type = 'booking' AND target_id = b.id AND type != 'refund'), 0)::text AS total_paid
         FROM bookings b
         WHERE b.id = $1`,
        [verified.targetId]
      );
      const row = paidRes.rows[0];
      if (!row || BigInt(row.total_paid) < BigInt(row.price)) {
        res.status(402).json({ error: 'PAYMENT_NOT_COMPLETE' });
        return;
      }

      const photosRes = await query<PhotoRecord>(
        'SELECT * FROM photos WHERE booking_id = $1 ORDER BY created_at ASC',
        [verified.targetId]
      );

      if (verified.photoId === 'zip') {
        const zipItems = photosRes.rows.map((p, idx) => {
          const key = p.edited_storage_key || p.original_storage_key;
          const ext = path.extname(key) || '.jpg';
          return {
            storageKey: key,
            archiveName: `ICX_Booking_Deliverable_${idx + 1}${ext}`,
          };
        });

        await streamCompiledZip(
          zipItems,
          `ICX_Studios_Booking_${verified.targetId.slice(0, 8)}.zip`,
          res
        );
        return;
      }

      const targetPhoto = photosRes.rows.find((p) => p.id === verified.photoId);
      const cleanKey = targetPhoto?.edited_storage_key || targetPhoto?.original_storage_key;
      if (!targetPhoto || !cleanKey) {
        res.status(404).json({ error: 'CLEAN_FILE_NOT_FOUND' });
        return;
      }

      await streamPrivateFile(cleanKey, res, {
        asDownload: true,
        downloadFilename: `ICX_Shoot_${targetPhoto.id.slice(0, 8)}${path.extname(cleanKey)}`,
      });
    }
  }
);

// ============================================================================
// 7. PUBLIC MEDIA STORAGE (EQUIPMENT & PHOTOGRAPHER PORTFOLIO IMAGES)
// ============================================================================
uploadsRouter.post(
  '/media',
  requireAuth,
  rateLimiter({ scope: 'media_upload', windowSeconds: 60, maxRequests: 60 }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { base64Data, filename } = req.body as {
        base64Data?: string;
        filename?: string;
      };

      if (!base64Data) {
        res.status(400).json({ error: 'MISSING_DATA', message: 'base64Data is required.' });
        return;
      }

      let mimeType = 'image/jpeg';
      let ext = '.jpg';
      const match = base64Data.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
      if (match) {
        mimeType = match[1];
        if (mimeType.includes('png')) ext = '.png';
        else if (mimeType.includes('webp')) ext = '.webp';
        else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
      }

      const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(cleanBase64, 'base64');

      if (buffer.byteLength > 20 * 1024 * 1024) {
        res.status(413).json({ error: 'FILE_TOO_LARGE', message: 'Image must be under 20MB.' });
        return;
      }

      const mediaDir = path.resolve(process.cwd(), 'storage/public_media');
      await fsp.mkdir(mediaDir, { recursive: true });

      const safeName = `${crypto.randomUUID()}${ext}`;
      const filePath = path.join(mediaDir, safeName);
      await fsp.writeFile(filePath, buffer);

      const mediaUrl = `/api/v1/uploads/media/${safeName}`;
      res.status(201).json({ url: mediaUrl, filename: safeName });
    } catch (error) {
      res.status(500).json({
        error: 'MEDIA_SAVE_FAILED',
        message: error instanceof Error ? error.message : 'Failed to save media asset.',
      });
    }
  }
);

uploadsRouter.get(
  '/media/:filename',
  async (req: Request, res: Response): Promise<void> => {
    const rawFilename = path.basename(String(req.params.filename || ''));
    const mediaDir = path.resolve(process.cwd(), 'storage/public_media');
    const filePath = path.join(mediaDir, rawFilename);

    if (!filePath.startsWith(mediaDir)) {
      res.status(403).json({ error: 'ACCESS_DENIED' });
      return;
    }

    try {
      await fsp.access(filePath);
      const ext = path.extname(rawFilename).toLowerCase();
      const contentType =
        ext === '.png'
          ? 'image/png'
          : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
          ? 'image/gif'
          : 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      fs.createReadStream(filePath).pipe(res);
    } catch {
      res.status(404).json({ error: 'NOT_FOUND' });
    }
  }
);

