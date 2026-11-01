import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { query, withTransaction, recordAuditEvent } from '@icx/database';
import type { PhotoRecord } from '@icx/shared-types';
import { env } from '../config/env.js';
import {
  promoteStagingFile,
  resolveSafeStoragePath,
} from './storage.engine.js';
import {
  generateBurnedWatermarkedPreview,
  validatePhotographerDeliveryImage,
} from './watermark.engine.js';
import { dispatchNotification } from './notification.engine.js';

const TUS_VERSION = '1.0.0';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB per file (Requirement PE-02)
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/webp',
]);

export interface TusUploadMetadata {
  uploadId: string;
  userId: string;
  userRole: string;
  uploadType: 'order_original' | 'editor_edit' | 'booking_delivery' | 'watermark_asset';
  targetId: string; // order_id, booking_id, or 'system'
  photoId?: string; // For editor_edit replacing/versioning an existing photo
  filename: string;
  filetype: string;
  uploadLength: number;
  offset: number;
  createdAt: string;
}

const TUS_STAGING_DIR = path.resolve(process.cwd(), env.TUS_UPLOAD_DIR);

function parseTusMetadataHeader(headerValue: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headerValue) return result;

  for (const pair of headerValue.split(',')) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const [key, b64Val] = trimmed.split(' ');
    if (key && b64Val) {
      result[key] = Buffer.from(b64Val, 'base64').toString('utf8');
    } else if (key) {
      result[key] = '';
    }
  }
  return result;
}

function getMetaFilePath(uploadId: string): string {
  const safeId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(TUS_STAGING_DIR, `${safeId}.meta.json`);
}

function getBinaryFilePath(uploadId: string): string {
  const safeId = uploadId.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(TUS_STAGING_DIR, `${safeId}.part`);
}

function setTusHeaders(res: Response): void {
  res.setHeader('Tus-Resumable', TUS_VERSION);
  res.setHeader('Tus-Version', TUS_VERSION);
  res.setHeader('Tus-Max-Size', String(MAX_FILE_SIZE_BYTES));
  res.setHeader('Tus-Extension', 'creation,termination');
  res.setHeader('Cache-Control', 'no-store');
}

/**
 * Finalizes a completed TUS upload into private storage, executes `sharp` burned-in
 * watermarking, and updates PostgreSQL atomically.
 */
export async function finalizeCompletedUpload(
  meta: TusUploadMetadata,
  binaryStagingPath: string
): Promise<PhotoRecord | { watermarkKey: string }> {
  const ext = path.extname(meta.filename).toLowerCase() || '.jpg';
  const uniqueFileName = `${Date.now()}_${crypto.randomUUID()}${ext}`;

  if (meta.uploadType === 'watermark_asset') {
    const key = await promoteStagingFile(
      binaryStagingPath,
      'system',
      'watermark.png'
    );
    await query(
      `UPDATE platform_settings
       SET value = jsonb_set(value, '{asset_storage_key}', to_jsonb($1::text)),
           updated_at = NOW()
       WHERE key = 'watermark_config'`,
      [key]
    );
    return { watermarkKey: key };
  }

  if (meta.uploadType === 'order_original') {
    // Verify order photo count limit (max 100 files per order per PE-02)
    const countRes = await query<{ count: string; customer_id: string }>(
      `SELECT
         (SELECT COUNT(*) FROM photos WHERE order_id = eo.id)::text AS count,
         eo.customer_id
       FROM edit_orders eo
       WHERE eo.id = $1`,
      [meta.targetId]
    );
    const orderInfo = countRes.rows[0];
    if (!orderInfo) {
      throw new Error('Target edit order does not exist.');
    }
    if (Number(orderInfo.count) >= 100) {
      throw new Error('Maximum limit of 100 files per edit order reached.');
    }

    const originalKey = await promoteStagingFile(
      binaryStagingPath,
      'originals',
      `orders/${meta.targetId}/${uniqueFileName}`
    );

    // Also generate a 1,200px watermarked preview of the original for the before/after slider
    let initialPreviewKey: string | null = null;
    try {
      const preview = await generateBurnedWatermarkedPreview(
        originalKey,
        `orders/${meta.targetId}/orig_preview_${uniqueFileName}`
      );
      initialPreviewKey = preview.previewStorageKey;
    } catch {
      // Non-standard RAW/HEIC without decode codec still stores original safely
    }

    const insertRes = await query<PhotoRecord>(
      `INSERT INTO photos (order_id, original_storage_key, preview_storage_key, version, uploaded_by)
       VALUES ($1, $2, $3, 1, $4)
       RETURNING *`,
      [meta.targetId, originalKey, initialPreviewKey, meta.userId]
    );

    return insertRes.rows[0]!;
  }

  if (meta.uploadType === 'editor_edit') {
    if (!meta.photoId) {
      throw new Error('photoId metadata is required when uploading an edited photo.');
    }

    const editedKey = await promoteStagingFile(
      binaryStagingPath,
      'edits',
      `orders/${meta.targetId}/${uniqueFileName}`
    );

    // Burn server-side watermark into 1,200px preview (Requirement NF-02, PE-06)
    const { previewStorageKey } = await generateBurnedWatermarkedPreview(
      editedKey,
      `orders/${meta.targetId}/edit_preview_${uniqueFileName}`
    );

    const updatedPhoto = await withTransaction(async (client) => {
      const photoRes = await client.query<PhotoRecord>(
        `UPDATE photos
         SET edited_storage_key = $1,
             preview_storage_key = $2,
             version = version + 1
         WHERE id = $3 AND order_id = $4
         RETURNING *`,
        [editedKey, previewStorageKey, meta.photoId, meta.targetId]
      );
      const photo = photoRes.rows[0];
      if (!photo) {
        throw new Error('Target photo record not found for this order.');
      }

      // Resolve any open revision requests for this photo
      await client.query(
        `UPDATE revision_requests
         SET resolved_at = NOW()
         WHERE photo_id = $1 AND resolved_at IS NULL`,
        [photo.id]
      );

      // Check if all photos in the order now have edited_storage_key populated
      const pendingCheck = await client.query<{ unedited_count: string }>(
        `SELECT COUNT(*)::text AS unedited_count
         FROM photos
         WHERE order_id = $1 AND edited_storage_key IS NULL`,
        [meta.targetId]
      );

      if (Number(pendingCheck.rows[0]?.unedited_count ?? 1) === 0) {
        const orderUpdate = await client.query<{
          payment_state: string;
          customer_id: string;
        }>(
          `UPDATE edit_orders
           SET status = CASE WHEN payment_state = 'fully_paid' THEN 'delivered' ELSE 'ready_for_review' END
           WHERE id = $1
           RETURNING payment_state, customer_id`,
          [meta.targetId]
        );

        const customerId = orderUpdate.rows[0]?.customer_id;
        if (customerId) {
          const userEmailRes = await client.query<{ email: string }>(
            'SELECT email FROM users WHERE id = $1 LIMIT 1',
            [customerId]
          );
          const email = userEmailRes.rows[0]?.email;
          if (email) {
            await dispatchNotification({
              triggerId: 'NT-02',
              recipientEmail: email,
              recipientUserId: customerId,
              subject: 'Your Edited Photos Are Ready for Review',
              htmlBody:
                '<p>Your edited photos have been processed and watermarked previews are ready for your inspection.</p>',
              targetEntity: 'edit_orders',
              targetId: meta.targetId,
            });
          }
        }
      }

      await recordAuditEvent(
        {
          actorId: meta.userId,
          action: 'EDITOR_UPLOADED_FINISHED_EDIT',
          targetEntity: 'photos',
          targetId: photo.id,
          details: { orderId: meta.targetId, version: photo.version },
        },
        client
      );

      return photo;
    });

    return updatedPhoto;
  }

  if (meta.uploadType === 'booking_delivery') {
    // PP-05: Validate delivery resolution & integrity before accepting
    const validation = await validatePhotographerDeliveryImage(binaryStagingPath);
    if (!validation.valid) {
      await fsp.unlink(binaryStagingPath).catch(() => undefined);
      throw new Error(validation.reason || 'Photographer delivery failed quality validation.');
    }

    const deliveryKey = await promoteStagingFile(
      binaryStagingPath,
      'deliveries',
      `bookings/${meta.targetId}/${uniqueFileName}`
    );

    // PP-04: Automatically generate burned-in watermarked preview
    const { previewStorageKey } = await generateBurnedWatermarkedPreview(
      deliveryKey,
      `bookings/${meta.targetId}/delivery_preview_${uniqueFileName}`
    );

    const photo = await withTransaction(async (client) => {
      const insertRes = await client.query<PhotoRecord>(
        `INSERT INTO photos (booking_id, original_storage_key, edited_storage_key, preview_storage_key, version, uploaded_by)
         VALUES ($1, $2, $2, $3, 1, $4)
         RETURNING *`,
        [meta.targetId, deliveryKey, previewStorageKey, meta.userId]
      );

      await client.query(
        `UPDATE bookings
         SET status = CASE WHEN status = 'confirmed' THEN 'delivered' ELSE status END
         WHERE id = $1`,
        [meta.targetId]
      );

      return insertRes.rows[0]!;
    });

    return photo;
  }

  throw new Error(`Unsupported uploadType: ${meta.uploadType}`);
}

/**
 * TUS OPTIONS handler
 */
export function handleTusOptions(_req: Request, res: Response): void {
  setTusHeaders(res);
  res.status(204).end();
}

/**
 * TUS POST handler: Creates a new resumable upload resource.
 */
export async function handleTusCreate(req: Request, res: Response): Promise<void> {
  setTusHeaders(res);

  const uploadLength = Number(req.headers['upload-length']);
  if (!Number.isFinite(uploadLength) || uploadLength <= 0) {
    res.status(400).json({
      error: 'INVALID_UPLOAD_LENGTH',
      message: 'Upload-Length header is required and must be positive.',
    });
    return;
  }

  if (uploadLength > MAX_FILE_SIZE_BYTES) {
    res.status(413).json({
      error: 'FILE_TOO_LARGE',
      message: 'File exceeds the 50 MB maximum size limit (Requirement PE-02).',
    });
    return;
  }

  const parsedMeta = parseTusMetadataHeader(
    req.headers['upload-metadata'] as string | undefined
  );
  const filetype = (parsedMeta.filetype || 'image/jpeg').toLowerCase();

  if (!ALLOWED_MIME_TYPES.has(filetype)) {
    res.status(415).json({
      error: 'UNSUPPORTED_FILE_TYPE',
      message: `Unsupported file type (${filetype}). Allowed: JPG, PNG, HEIC, TIFF, WebP.`,
    });
    return;
  }

  const uploadType = (parsedMeta.uploadType || 'order_original') as TusUploadMetadata['uploadType'];
  const targetId = parsedMeta.targetId || '';
  if (!targetId) {
    res.status(400).json({
      error: 'MISSING_TARGET_ID',
      message: 'targetId metadata is required in Upload-Metadata.',
    });
    return;
  }

  const uploadId = crypto.randomUUID();
  const meta: TusUploadMetadata = {
    uploadId,
    userId: req.user!.sub,
    userRole: req.user!.role,
    uploadType,
    targetId,
    photoId: parsedMeta.photoId,
    filename: parsedMeta.filename || `upload_${uploadId}.jpg`,
    filetype,
    uploadLength,
    offset: 0,
    createdAt: new Date().toISOString(),
  };

  await fsp.mkdir(TUS_STAGING_DIR, { recursive: true });
  await fsp.writeFile(getMetaFilePath(uploadId), JSON.stringify(meta, null, 2), 'utf8');
  await fsp.writeFile(getBinaryFilePath(uploadId), Buffer.alloc(0));

  const location = `${req.protocol}://${req.get('host')}/api/v1/uploads/tus/${uploadId}`;
  res.setHeader('Location', location);
  res.setHeader('Upload-Offset', '0');
  res.status(201).end();
}

/**
 * TUS HEAD handler: Returns current byte offset so client can resume interrupted uploads (NF-12).
 */
export async function handleTusHead(req: Request, res: Response): Promise<void> {
  setTusHeaders(res);
  const uploadId = String(req.params.uploadId || '');

  try {
    const metaRaw = await fsp.readFile(getMetaFilePath(uploadId), 'utf8');
    const meta = JSON.parse(metaRaw) as TusUploadMetadata;
    const stat = await fsp.stat(getBinaryFilePath(uploadId));

    res.setHeader('Upload-Offset', String(stat.size));
    res.setHeader('Upload-Length', String(meta.uploadLength));
    res.status(200).end();
  } catch {
    res.status(404).end();
  }
}

/**
 * TUS PATCH handler: Streams chunk bytes to the staging file from `Upload-Offset`.
 */
export async function handleTusPatch(req: Request, res: Response): Promise<void> {
  setTusHeaders(res);
  const uploadId = String(req.params.uploadId || '');

  let meta: TusUploadMetadata;
  let currentSize: number;
  const metaPath = getMetaFilePath(uploadId);
  const binPath = getBinaryFilePath(uploadId);

  try {
    const metaRaw = await fsp.readFile(metaPath, 'utf8');
    meta = JSON.parse(metaRaw) as TusUploadMetadata;
    const stat = await fsp.stat(binPath);
    currentSize = stat.size;
  } catch {
    res.status(404).json({ error: 'UPLOAD_NOT_FOUND' });
    return;
  }

  if (meta.userId !== req.user!.sub && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'FORBIDDEN_UPLOAD_OWNER' });
    return;
  }

  const clientOffset = Number(req.headers['upload-offset']);
  if (!Number.isFinite(clientOffset) || clientOffset !== currentSize) {
    res.status(409).json({
      error: 'OFFSET_MISMATCH',
      expectedOffset: currentSize,
      receivedOffset: clientOffset,
    });
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const writeStream = fs.createWriteStream(binPath, { flags: 'a' });
      req.pipe(writeStream);
      writeStream.on('finish', () => resolve());
      writeStream.on('error', (err) => reject(err));
      req.on('error', (err) => reject(err));
    });

    const updatedStat = await fsp.stat(binPath);
    meta.offset = updatedStat.size;
    await fsp.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    res.setHeader('Upload-Offset', String(updatedStat.size));

    if (updatedStat.size >= meta.uploadLength) {
      const finalized = await finalizeCompletedUpload(meta, binPath);
      await fsp.unlink(metaPath).catch(() => undefined);
      if ('id' in finalized) {
        res.setHeader('X-ICX-Photo-Id', finalized.id);
      }
    }

    res.status(204).end();
  } catch (error) {
    res.status(422).json({
      error: 'UPLOAD_FINALIZATION_FAILED',
      message: error instanceof Error ? error.message : 'Upload chunk processing failed.',
    });
  }
}

