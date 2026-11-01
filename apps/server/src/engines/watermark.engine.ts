import sharp from 'sharp';
import fsp from 'node:fs/promises';
import { query } from '@icx/database';
import {
  resolveSafeStoragePath,
  storePrivateBuffer,
} from './storage.engine.js';

interface WatermarkConfig {
  opacity: number;
  scale_ratio: number;
  asset_storage_key: string;
}

const MAX_PREVIEW_LONG_EDGE = 1200; // Strictly enforced per PE-06 & NF-02

/**
 * Fetches dynamic watermark configuration set by Admin (Requirement AD-09).
 */
export async function getWatermarkConfig(): Promise<WatermarkConfig> {
  try {
    const res = await query<{ value: WatermarkConfig }>(
      "SELECT value FROM platform_settings WHERE key = 'watermark_config' LIMIT 1"
    );
    if (res.rows[0]?.value) {
      const cfg = res.rows[0].value;
      return {
        opacity: Math.min(1, Math.max(0.1, Number(cfg.opacity ?? 0.45))),
        scale_ratio: Math.min(0.8, Math.max(0.15, Number(cfg.scale_ratio ?? 0.35))),
        asset_storage_key: cfg.asset_storage_key || 'system/watermark.png',
      };
    }
  } catch {
    // Fallback to default config if DB not yet seeded
  }
  return {
    opacity: 0.45,
    scale_ratio: 0.35,
    asset_storage_key: 'system/watermark.png',
  };
}

/**
 * Builds a high-contrast diagonal + center burned-in SVG/PNG watermark overlay matching
 * the target dimensions and admin-configured opacity. If the admin uploaded a custom PNG
 * watermark (`system/watermark.png`), it composites BOTH the custom PNG badge and the
 * diagonal anti-theft security grid across the entire pixel surface.
 */
async function buildWatermarkOverlayBuffer(
  width: number,
  height: number,
  config: WatermarkConfig
): Promise<Buffer> {
  const alpha = Math.round(config.opacity * 255) / 255;

  // Diagonal repeating pattern + center ICX Studios crest burned across all quadrants
  const svgOverlay = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="icxGrid" width="280" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(-32)">
          <text x="15" y="80" fill="#E8DEC8" fill-opacity="${alpha}" stroke="#2A3439" stroke-width="1" stroke-opacity="${alpha * 0.8}" font-family="sans-serif" font-weight="800" font-size="22" letter-spacing="3">
            ICX STUDIOS PREVIEW
          </text>
          <text x="15" y="110" fill="#E8DEC8" fill-opacity="${alpha * 0.85}" font-family="sans-serif" font-weight="700" font-size="12" letter-spacing="2">
            UNPAID PROOF • DO NOT REPRODUCE
          </text>
          <line x1="0" y1="140" x2="280" y2="140" stroke="#E8DEC8" stroke-opacity="${alpha * 0.4}" stroke-width="1.5" stroke-dasharray="6,6" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#icxGrid)" />
      <g transform="translate(${Math.round(width / 2)}, ${Math.round(height / 2)})">
        <rect x="-150" y="-42" width="300" height="84" rx="10" fill="#2A3439" fill-opacity="${Math.min(0.85, alpha + 0.2)}" stroke="#E8DEC8" stroke-opacity="${alpha}" stroke-width="2" />
        <text x="0" y="-4" text-anchor="middle" fill="#E8DEC8" fill-opacity="${Math.min(0.95, alpha + 0.35)}" font-family="sans-serif" font-weight="900" font-size="26" letter-spacing="4">
          ICX STUDIOS
        </text>
        <text x="0" y="22" text-anchor="middle" fill="#E8DEC8" fill-opacity="${Math.min(0.9, alpha + 0.25)}" font-family="sans-serif" font-weight="600" font-size="11" letter-spacing="2.5">
          PROTECTED WATERMARKED PREVIEW
        </text>
      </g>
    </svg>
  `;

  let baseOverlay = await sharp(Buffer.from(svgOverlay)).png().toBuffer();

  // If admin uploaded a custom PNG watermark file, composite it in the center as well
  try {
    const customPath = resolveSafeStoragePath(config.asset_storage_key);
    await fsp.access(customPath);
    const targetLogoWidth = Math.max(
      120,
      Math.round(Math.min(width, height) * config.scale_ratio)
    );
    const customLogoBuffer = await sharp(customPath)
      .resize({ width: targetLogoWidth, withoutEnlargement: true })
      .ensureAlpha(config.opacity)
      .png()
      .toBuffer();

    baseOverlay = await sharp(baseOverlay)
      .composite([{ input: customLogoBuffer, gravity: 'center' }])
      .png()
      .toBuffer();
  } catch {
    // Use the SVG security grid + center crest if no custom PNG file is on disk yet
  }

  return baseOverlay;
}

/**
 * Generates a server-side burned-in watermarked preview (max 1,200px long edge, stripped EXIF)
 * and saves it to the isolated `previews/` namespace (Requirements NF-01, NF-02, PE-06, PP-04).
 */
export async function generateBurnedWatermarkedPreview(
  sourceStorageKey: string,
  targetSubPath: string
): Promise<{
  previewStorageKey: string;
  width: number;
  height: number;
}> {
  const sourceFullPath = resolveSafeStoragePath(sourceStorageKey);
  const config = await getWatermarkConfig();

  // Resize image so longest edge is at most 1,200px and auto-orient EXIF
  const resizedPipeline = sharp(sourceFullPath, { failOn: 'none' })
    .rotate()
    .resize({
      width: MAX_PREVIEW_LONG_EDGE,
      height: MAX_PREVIEW_LONG_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    });

  const { data: resizedBuffer, info } = await resizedPipeline
    .png()
    .toBuffer({ resolveWithObject: true });

  const overlayBuffer = await buildWatermarkOverlayBuffer(
    info.width,
    info.height,
    config
  );

  // Permanently composite the watermark into the pixels and encode as WebP/JPEG with no metadata
  const watermarkedBuffer = await sharp(resizedBuffer)
    .composite([{ input: overlayBuffer, top: 0, left: 0, blend: 'over' }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const previewStorageKey = await storePrivateBuffer(
    'previews',
    targetSubPath.replace(/\.[^.]+$/, '.jpg'),
    watermarkedBuffer
  );

  return {
    previewStorageKey,
    width: info.width,
    height: info.height,
  };
}

/**
 * Requirement PP-05: Validates photographer shoot delivery uploads before acceptance.
 * Rejects corrupted images, images smaller than 1200px on the longest edge, or zero-byte buffers.
 */
export async function validatePhotographerDeliveryImage(filePath: string): Promise<{
  valid: boolean;
  reason?: string;
  width?: number;
  height?: number;
  format?: string;
}> {
  try {
    const metadata = await sharp(filePath).metadata();
    if (!metadata.width || !metadata.height || !metadata.format) {
      return { valid: false, reason: 'Unreadable or corrupted image file.' };
    }

    const longEdge = Math.max(metadata.width, metadata.height);
    if (longEdge < 1200) {
      return {
        valid: false,
        reason: `Deliverable resolution too low (${metadata.width}x${metadata.height}). Minimum long edge is 1,200px.`,
      };
    }

    return {
      valid: true,
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    };
  } catch {
    return {
      valid: false,
      reason: 'File failed server-side image decode verification.',
    };
  }
}

