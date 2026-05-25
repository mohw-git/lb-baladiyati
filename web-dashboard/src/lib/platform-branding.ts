import {
  DEFAULT_BANNER_FOCAL,
  DEFAULT_BANNER_OVERLAY_COLOR,
  normalizeBannerFocal,
  normalizeOverlayOpacity,
} from '@/lib/municipality-branding';

/** Default dark overlay for auth pages (45–60% range). */
export const DEFAULT_AUTH_BACKGROUND_OVERLAY_OPACITY = 0.55;

/** Crop aspect for auth page background uploads (1920×1080). */
export const AUTH_BACKGROUND_CROP_ASPECT = 1920 / 1080;

export type PlatformBrandingBackgroundSource = {
  authBackgroundImageUrl?: string | null;
  bannerImageUrl?: string | null;
  authBackgroundFocalX?: number | null;
  authBackgroundFocalY?: number | null;
  bannerFocalX?: number | null;
  bannerFocalY?: number | null;
  authBackgroundOverlayOpacity?: number | null;
  bannerOverlayOpacity?: number | null;
  bannerOverlayColor?: string | null;
};

/** Resolved background for login/register/forgot/reset/verify pages. */
export function resolveAuthPageBackground(branding: PlatformBrandingBackgroundSource | undefined) {
  const usesDedicated = Boolean(branding?.authBackgroundImageUrl);
  return {
    imageUrl: branding?.authBackgroundImageUrl || branding?.bannerImageUrl || null,
    focalX: usesDedicated
      ? normalizeBannerFocal(branding?.authBackgroundFocalX, DEFAULT_BANNER_FOCAL)
      : normalizeBannerFocal(branding?.bannerFocalX, DEFAULT_BANNER_FOCAL),
    focalY: usesDedicated
      ? normalizeBannerFocal(branding?.authBackgroundFocalY, DEFAULT_BANNER_FOCAL)
      : normalizeBannerFocal(branding?.bannerFocalY, DEFAULT_BANNER_FOCAL),
    overlayColor: branding?.bannerOverlayColor ?? DEFAULT_BANNER_OVERLAY_COLOR,
    overlayOpacity: usesDedicated
      ? normalizeOverlayOpacity(
          branding?.authBackgroundOverlayOpacity,
          DEFAULT_AUTH_BACKGROUND_OVERLAY_OPACITY,
        )
      : normalizeOverlayOpacity(branding?.bannerOverlayOpacity ?? 0.72),
    usesDedicatedAuth: usesDedicated,
  };
}
