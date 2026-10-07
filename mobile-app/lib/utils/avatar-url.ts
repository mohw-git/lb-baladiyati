import { getFileUrl } from '../api/client';

/** Avatar URL with optional cache-busting for React Native `Image`. */
export function getAvatarImageUri(
  path: string | null | undefined,
  cacheBust?: string | number,
): string {
  const base = getFileUrl(path ?? '');
  if (!base) return '';
  if (cacheBust == null || cacheBust === '') return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}v=${encodeURIComponent(String(cacheBust))}`;
}
