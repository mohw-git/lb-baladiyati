'use client';

import { PublicHeroBackground } from '@/components/brand/public-hero-background';
import { cn } from '@/lib/utils';

type HomepageHeroPreviewProps = {
  platformName: string;
  platformDescription?: string;
  officialPortalLabel: string;
  submitLabel: string;
  trackLabel: string;
  emergencyLabel: string;
  bannerImageUrl?: string | null;
  bannerOverlayColor?: string | null;
  bannerOverlayOpacity?: number | null;
  bannerFocalX?: number | null;
  bannerFocalY?: number | null;
  className?: string;
};

/** Miniature of the public homepage hero — matches crop, overlay, and focal point. */
export function HomepageHeroPreview({
  platformName,
  platformDescription,
  officialPortalLabel,
  submitLabel,
  trackLabel,
  emergencyLabel,
  bannerImageUrl,
  bannerOverlayColor,
  bannerOverlayOpacity,
  bannerFocalX,
  bannerFocalY,
  className,
}: HomepageHeroPreviewProps) {
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded border border-gray-300 text-white shadow-sm',
        className,
      )}
    >
      <PublicHeroBackground
        bannerImageUrl={bannerImageUrl}
        bannerOverlayColor={bannerOverlayColor}
        bannerOverlayOpacity={bannerOverlayOpacity}
        bannerFocalX={bannerFocalX}
        bannerFocalY={bannerFocalY}
      />
      <div className="relative z-10 p-4">
        <div className="grid gap-3 lg:grid-cols-[1.4fr,0.6fr] lg:items-center">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest text-white/65">
              {officialPortalLabel}
            </p>
            <p className="mt-1 text-sm font-bold leading-tight drop-shadow-sm">{platformName}</p>
            {platformDescription ? (
              <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/80">
                {platformDescription}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="rounded-sm bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-navy-950">
                {submitLabel}
              </span>
              <span className="rounded-sm border border-white/35 bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase">
                {trackLabel}
              </span>
            </div>
          </div>
          <div className="rounded border border-white/20 bg-white/10 p-2 backdrop-blur-sm">
            <p className="text-[9px] font-bold uppercase tracking-wide text-amber-200">
              {emergencyLabel}
            </p>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 start-0 end-0 z-10 h-0.5 bg-gradient-to-r from-red-600 via-white to-green-700" />
    </div>
  );
}
