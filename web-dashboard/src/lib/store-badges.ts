import type { Locale } from '@shared/types/locale';

/** Fixed rendered height (px) for App Store and Google Play badges — width scales automatically. */
export const STORE_BADGE_HEIGHT_PX = 40;

const GOOGLE_PLAY_BADGES: Record<Locale, string> = {
  en: '/store-badges/google-play-en.png',
  ar: '/store-badges/google-play-ar.png',
  fr: '/store-badges/google-play-fr.png',
};

/** Black lockup — for light surfaces or badges on a white pad. */
const APP_STORE_BADGES: Record<Locale, string> = {
  en: '/store-badges/app-store-en.svg',
  ar: '/store-badges/app-store-ar.svg',
  fr: '/store-badges/app-store-fr.svg',
};

/** White lockup — for dark backgrounds (homepage download band). */
const APP_STORE_BADGES_ON_DARK: Record<Locale, string> = {
  en: '/store-badges/app-store-en-wht.svg',
  ar: '/store-badges/app-store-ar-wht.svg',
  fr: '/store-badges/app-store-fr-wht.svg',
};

export function googlePlayBadgeSrc(locale: Locale): string {
  return GOOGLE_PLAY_BADGES[locale] ?? GOOGLE_PLAY_BADGES.en;
}

export function appStoreBadgeSrc(locale: Locale, onDarkBackground: boolean): string {
  const map = onDarkBackground ? APP_STORE_BADGES_ON_DARK : APP_STORE_BADGES;
  return map[locale] ?? map.en;
}
