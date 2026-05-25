import { getFileUrl } from '@/lib/api/client';

/** Shared defaults — keep sidebar, settings form, and API fallbacks aligned. */
export const DEFAULT_PRIMARY_COLOR = '#0f2555';
export const DEFAULT_BANNER_OVERLAY_COLOR = '#0f2555';
export const DEFAULT_BANNER_OVERLAY_OPACITY = 0.6;
export const DEFAULT_BANNER_FOCAL = 50;

/** Hero banner crop aspect used in admin (wide institutional banner). */
export const HERO_BANNER_CROP_ASPECT = 1920 / 560;

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Accept only valid hex colors; otherwise return fallback. */
export function sanitizeHexColor(
  value: string | null | undefined,
  fallback: string = DEFAULT_PRIMARY_COLOR,
): string {
  if (!value?.trim()) return fallback;
  const v = value.trim();
  if (HEX_COLOR.test(v)) return v;
  return fallback;
}

export function normalizeOverlayOpacity(
  value: number | null | undefined,
  fallback: number = DEFAULT_BANNER_OVERLAY_OPACITY,
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

/** Resolve branding media paths via the API host. */
export function resolveMunicipalityMediaUrl(
  path: string | null | undefined,
): string {
  if (!path) return '';
  return getFileUrl(path);
}

/** Alias used by shared BrandHeader (municipality + platform). */
export const resolveBrandMediaUrl = resolveMunicipalityMediaUrl;

/** Clamp banner focal point to 0–100 (percent for CSS object-position). */
export function normalizeBannerFocal(
  value: number | null | undefined,
  fallback: number = DEFAULT_BANNER_FOCAL,
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.min(100, Math.max(0, value));
}

/** CSS object-position from focal percentages. */
export function bannerObjectPosition(
  focalX: number | null | undefined,
  focalY: number | null | undefined,
): string {
  const x = normalizeBannerFocal(focalX);
  const y = normalizeBannerFocal(focalY);
  return `${x}% ${y}%`;
}
