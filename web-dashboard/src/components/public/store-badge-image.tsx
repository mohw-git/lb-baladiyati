'use client';

import {
  STORE_BADGE_HEIGHT_PX,
  appStoreBadgeSrc,
  googlePlayBadgeSrc,
} from '@/lib/store-badges';
import { useLocale } from '@/lib/i18n';

type StoreKind = 'app-store' | 'google-play';

interface StoreBadgeImageProps {
  kind: StoreKind;
  /** Homepage navy band vs light download card */
  onDarkBackground?: boolean;
  /** Override rendered height (default from store-badges constant). */
  height?: number;
  className?: string;
}

/**
 * Official store badge with fixed height and preserved aspect ratio.
 * Uses locale-specific assets from /public/store-badges/.
 */
export function StoreBadgeImage({
  kind,
  onDarkBackground = false,
  height = STORE_BADGE_HEIGHT_PX,
  className = '',
}: StoreBadgeImageProps) {
  const locale = useLocale();
  const src =
    kind === 'app-store'
      ? appStoreBadgeSrc(locale, onDarkBackground)
      : googlePlayBadgeSrc(locale);

  const alt =
    kind === 'app-store'
      ? locale === 'ar'
        ? 'حمّل من App Store'
        : locale === 'fr'
          ? "Télécharger dans l'App Store"
          : 'Download on the App Store'
      : locale === 'ar'
        ? 'احصل عليه من Google Play'
        : locale === 'fr'
          ? 'Disponible sur Google Play'
          : 'Get it on Google Play';

  return (
    <img
      src={src}
      alt={alt}
      height={height}
      className={`block h-full w-auto max-w-none object-contain ${className}`}
      style={{ height, width: 'auto', objectFit: 'contain' }}
      decoding="async"
      draggable={false}
    />
  );
}
