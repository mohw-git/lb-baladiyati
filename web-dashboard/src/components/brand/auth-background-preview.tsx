'use client';

import { PublicHeroBackground } from '@/components/brand/public-hero-background';
import { cn } from '@/lib/utils';

type AuthBackgroundPreviewProps = {
  imageUrl?: string | null;
  overlayColor?: string | null;
  overlayOpacity?: number | null;
  focalX?: number | null;
  focalY?: number | null;
  loginLabel: string;
  className?: string;
};

/** Mini preview of login/register full-page background. */
export function AuthBackgroundPreview({
  imageUrl,
  overlayColor,
  overlayOpacity,
  focalX,
  focalY,
  loginLabel,
  className,
}: AuthBackgroundPreviewProps) {
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded border border-gray-300 shadow-sm',
        className,
      )}
      style={{ minHeight: 140 }}
    >
      <PublicHeroBackground
        tone="auth"
        bannerImageUrl={imageUrl}
        bannerOverlayColor={overlayColor}
        bannerOverlayOpacity={overlayOpacity}
        bannerFocalX={focalX}
        bannerFocalY={focalY}
      />
      <div className="relative z-10 flex items-center justify-center p-6">
        <div className="w-full max-w-[200px] rounded-lg border border-white/20 bg-white/95 px-3 py-2 text-center shadow-lg">
          <p className="text-[10px] font-bold text-navy-950">{loginLabel}</p>
          <div className="mt-2 h-2 rounded bg-gray-100" />
          <div className="mt-1 h-6 rounded bg-navy-900/90" />
        </div>
      </div>
    </div>
  );
}
