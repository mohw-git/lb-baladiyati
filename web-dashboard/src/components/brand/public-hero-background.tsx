'use client';

import { cn } from '@/lib/utils';
import {
  DEFAULT_BANNER_OVERLAY_COLOR,
  bannerObjectPosition,
  normalizeOverlayOpacity,
  resolveBrandMediaUrl,
  sanitizeHexColor,
} from '@/lib/municipality-branding';

const FALLBACK_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd' stroke='%23ffffff' stroke-opacity='1'%3E%3Cpath d='M0 40h80M40 0v80'/%3E%3Cpath d='M20 20h40v40H20z'/%3E%3C/g%3E%3C/svg%3E\")";

export type PublicHeroBackgroundProps = {
  bannerImageUrl?: string | null;
  bannerOverlayColor?: string | null;
  bannerOverlayOpacity?: number | null;
  bannerFocalX?: number | null;
  bannerFocalY?: number | null;
  /** Homepage hero uses layered gradients; auth uses a single slider-controlled overlay. */
  tone?: 'hero' | 'auth';
  className?: string;
};

/**
 * Decorative full-bleed background: banner image, optional overlay, gradients.
 * Hero: layered gradients + configurable overlay (homepage).
 * Auth: one dark overlay (0–100% slider) + light fixed vignettes for form/panel text.
 */
export function PublicHeroBackground({
  bannerImageUrl,
  bannerOverlayColor,
  bannerOverlayOpacity,
  bannerFocalX,
  bannerFocalY,
  tone = 'hero',
  className,
}: PublicHeroBackgroundProps) {
  const isAuth = tone === 'auth';
  const bannerSrc = resolveBrandMediaUrl(bannerImageUrl);
  const overlayColor = sanitizeHexColor(
    bannerOverlayColor,
    DEFAULT_BANNER_OVERLAY_COLOR,
  );
  const overlayOpacity = normalizeOverlayOpacity(bannerOverlayOpacity);
  const objectPosition = bannerObjectPosition(bannerFocalX, bannerFocalY);

  return (
    <div className={cn('absolute inset-0 overflow-hidden bg-navy-950', className)}>
      {bannerSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bannerSrc}
          alt=""
          className="absolute inset-0 h-full w-full max-w-none object-cover"
          style={{ objectPosition }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: FALLBACK_PATTERN }}
        />
      )}

      {isAuth ? (
        <>
          {/* Single intentional dark overlay — opacity is the admin slider (0 = image visible, 1 = very dark) */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: overlayColor,
              opacity: bannerSrc ? overlayOpacity : 0.55,
            }}
            aria-hidden
          />
          {bannerSrc ? (
            <>
              {/* Light vignette for form column / bottom edge — does not replace the slider */}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10 md:from-black/15"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-black/35 via-black/10 to-transparent md:block"
                aria-hidden
              />
              {/* Slight mobile-only boost so cards stay readable without hiding the image */}
              <div
                className="pointer-events-none absolute inset-0 bg-navy-950/12 md:hidden"
                aria-hidden
              />
            </>
          ) : (
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-navy-950/80 via-navy-950/90 to-navy-950"
              aria-hidden
            />
          )}
        </>
      ) : (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-navy-950/50 via-navy-950/65 to-navy-950/90"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-navy-950/92 via-navy-950/72 to-navy-950/40"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundColor: overlayColor,
              opacity: bannerSrc ? overlayOpacity : 0.55,
            }}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
