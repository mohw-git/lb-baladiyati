import * as fs from 'fs';
import * as path from 'path';

const DEFAULT_UPLOAD_PATH = './uploads';

/**
 * Resolves UPLOAD_PATH to an absolute directory on disk.
 * Relative paths are anchored to process.cwd() (repo root when running Nest).
 */
export function resolveUploadRoot(rawPath?: string): string {
  const configured = (rawPath ?? process.env.UPLOAD_PATH ?? DEFAULT_UPLOAD_PATH).trim();
  const resolved = path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
  return path.normalize(resolved);
}

/** Ensures the upload root (and optional subfolder) exists. */
export function ensureUploadDir(root: string, subfolder?: string): string {
  const dir = subfolder ? path.join(root, subfolder) : root;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** URL prefix served by the API for stored files. */
export const UPLOAD_URL_PREFIX = '/uploads';

/** Join upload root with a DB storage key (e.g. kyc/<id>/file.jpg). */
export function resolveUploadFilePath(
  root: string,
  storageKey: string,
): string {
  const normalizedKey = storageKey.replace(/^\/+/, '').replace(/\\/g, '/');
  return path.join(root, ...normalizedKey.split('/'));
}

/** Public URL path for a stored file. */
export function toUploadUrlPath(storageKey: string): string {
  const key = storageKey.replace(/^\/+/, '').replace(/\\/g, '/');
  return `${UPLOAD_URL_PREFIX}/${key}`;
}
