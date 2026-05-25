'use client';

import { cn } from '@/lib/utils';
import {
  DEFAULT_BANNER_OVERLAY_COLOR,
  DEFAULT_BANNER_OVERLAY_OPACITY,
  DEFAULT_PRIMARY_COLOR,
  bannerObjectPosition,
  normalizeOverlayOpacity,
  resolveBrandMediaUrl,
  sanitizeHexColor,
} from '@/lib/municipality-branding';

export type BrandHeaderProps = {
  name: string;
  subtitle?: string;
  logoUrl?: string | null;
  bannerImageUrl?: string | null;
  bannerOverlayColor?: string | null;
  bannerOverlayOpacity?: number | null;
  bannerFocalX?: number | null;
  bannerFocalY?: number | null;
  primaryColor?: string | null;
  /** Compact sidebar strip vs taller dashboard/login preview. */
  variant?: 'sidebar' | 'hero';
  className?: string;
};

/**
 * Shared logo + optional banner preview for municipality and platform branding.
 */
export function BrandHeader({
  name,
  subtitle,
  logoUrl,
  bannerImageUrl,
  bannerOverlayColor,
  bannerOverlayOpacity,
  bannerFocalX,
  bannerFocalY,
  primaryColor,
  variant = 'sidebar',
  className,
}: BrandHeaderProps) {
  const primary = sanitizeHexColor(primaryColor, DEFAULT_PRIMARY_COLOR);
  const overlayColor = sanitizeHexColor(
    bannerOverlayColor,
    DEFAULT_BANNER_OVERLAY_COLOR,
  );
  const overlayOpacity = normalizeOverlayOpacity(bannerOverlayOpacity);
  const bannerSrc = resolveBrandMediaUrl(bannerImageUrl);
  const bannerPosition = bannerObjectPosition(bannerFocalX, bannerFocalY);
  const logoSrc = resolveBrandMediaUrl(logoUrl);
  const isHero = variant === 'hero';
  const initial = (name || 'B').charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        'relative overflow-hidden text-white',
        isHero ? 'h-28' : 'h-14',
        className,
      )}
      style={{ backgroundColor: primary }}
    >
      {bannerSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bannerSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: bannerPosition }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: overlayColor,
              opacity: overlayOpacity,
            }}
          />
        </>
      ) : null}
      <div
        className={cn(
          'relative flex h-full items-center',
          isHero ? 'gap-3 px-4' : 'gap-2.5 px-3',
        )}
      >
        {logoSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt=""
            className={cn(
              'shrink-0 rounded object-contain bg-white/10',
              isHero ? 'h-12 w-12 p-1' : 'h-8 w-8',
            )}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            className={cn(
              'flex shrink-0 items-center justify-center rounded bg-white/20 font-bold',
              isHero ? 'h-12 w-12 text-lg' : 'h-8 w-8 text-sm',
            )}
          >
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'truncate font-semibold leading-tight',
              isHero ? 'text-sm font-bold' : 'text-sm',
            )}
          >
            {name || 'Baladi'}
          </div>
          {subtitle ? (
            <div
              className={cn(
                'truncate text-white/70',
                isHero
                  ? 'mt-0.5 text-[11px] text-white/85 line-clamp-2'
                  : 'text-[10px] uppercase tracking-widest',
              )}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
