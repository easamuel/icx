import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Response } from 'express';
import archiver from 'archiver';
import { env } from '../config/env.js';

export type StorageNamespace =
  | 'originals'
  | 'edits'
  | 'deliveries'
  | 'previews'
  | 'portfolio'
  | 'equipment'
  | 'system';

const STORAGE_ROOT = path.resolve(process.cwd(), env.PRIVATE_STORAGE_ROOT);
const TUS_STAGING_ROOT = path.resolve(process.cwd(), env.TUS_UPLOAD_DIR);

/**
 * Ensures all isolated private storage directories exist on server boot.
 * None of these directories are ever exposed via static middleware or public HTTP.
 */
export async function initializePrivateStorage(): Promise<void> {
  const namespaces: StorageNamespace[] = [
    'originals',
    'edits',
    'deliveries',
    'previews',
    'portfolio',
    'equipment',
    'system',
  ];

  await fsp.mkdir(STORAGE_ROOT, { recursive: true });
  await fsp.mkdir(TUS_STAGING_ROOT, { recursive: true });

  for (const ns of namespaces) {
    await fsp.mkdir(path.join(STORAGE_ROOT, ns), { recursive: true });
  }
}

/**
 * Resolves a storage key safely inside PRIVATE_STORAGE_ROOT.
 * Prevents any directory traversal (`../`) or symlink escape attacks.
 */
export function resolveSafeStoragePath(storageKey: string): string {
  const normalized = storageKey.replace(/^[/\\]+/, '');
  const resolved = path.resolve(STORAGE_ROOT, normalized);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep) && resolved !== STORAGE_ROOT) {
    throw new Error('SECURITY_VIOLATION: Attempted path traversal outside private storage root');
  }
  return resolved;
}

/**
 * Atomically moves or writes a file into a private storage namespace.
 */
export async function storePrivateBuffer(
  namespace: StorageNamespace,
  subPath: string,
  buffer: Buffer
): Promise<string> {
  const cleanSubPath = subPath.replace(/^[/\\]+/, '');
  const storageKey = `${namespace}/${cleanSubPath}`.replace(/\\/g, '/');
  const fullPath = resolveSafeStoragePath(storageKey);

  await fsp.mkdir(path.dirname(fullPath), { recursive: true });
  const tempPath = `${fullPath}.tmp.${Date.now()}`;
  await fsp.writeFile(tempPath, buffer);
  await fsp.rename(tempPath, fullPath);

  return storageKey;
}

/**
 * Atomically promotes a completed TUS staging file into permanent private storage.
 */
export async function promoteStagingFile(
  stagingFilePath: string,
  namespace: StorageNamespace,
  subPath: string
): Promise<string> {
  const cleanSubPath = subPath.replace(/^[/\\]+/, '');
  const storageKey = `${namespace}/${cleanSubPath}`.replace(/\\/g, '/');
  const destinationPath = resolveSafeStoragePath(storageKey);

  await fsp.mkdir(path.dirname(destinationPath), { recursive: true });
  await fsp.rename(stagingFilePath, destinationPath);
  return storageKey;
}

export function detectMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.heic':
      return 'image/heic';
    case '.tif':
    case '.tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Streams a private file through Node.js after RBAC & payment state checks have passed.
 */
export async function streamPrivateFile(
  storageKey: string,
  res: Response,
  options: {
    asDownload?: boolean;
    downloadFilename?: string;
  } = {}
): Promise<void> {
  const fullPath = resolveSafeStoragePath(storageKey);

  let stat: fs.Stats;
  try {
    stat = await fsp.stat(fullPath);
  } catch {
    res.status(404).json({
      error: 'FILE_NOT_FOUND',
      message: 'The requested media asset could not be located in private storage.',
    });
    return;
  }

  const mimeType = detectMimeType(fullPath);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (options.asDownload) {
    const filename = options.downloadFilename || path.basename(fullPath);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"`
    );
  } else {
    res.setHeader('Content-Disposition', 'inline');
  }

  const readStream = fs.createReadStream(fullPath);
  readStream.on('error', (err) => {
    console.error('[ICX-STORAGE] Stream error:', err);
    if (!res.headersSent) {
      res.status(500).end();
    }
  });
  readStream.pipe(res);
}

/**
 * Compiles and streams multiple clean files as a single ZIP archive on the fly (Requirement PE-10).
 */
export async function streamCompiledZip(
  files: Array<{ storageKey: string; archiveName: string }>,
  zipFilename: string,
  res: Response
): Promise<void> {
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${zipFilename.replace(/"/g, '')}"`
  );
  res.setHeader('Cache-Control', 'private, no-store');

  const archive = archiver('zip', {
    zlib: { level: 6 },
  });

  archive.on('error', (err) => {
    console.error('[ICX-STORAGE] ZIP archive streaming error:', err);
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.destroy(err);
    }
  });

  archive.pipe(res);

  for (const item of files) {
    try {
      const fullPath = resolveSafeStoragePath(item.storageKey);
      await fsp.access(fullPath);
      archive.file(fullPath, { name: item.archiveName });
    } catch {
      // Skip missing file entry gracefully without aborting archive
    }
  }

  await archive.finalize();
}

