/**
 * Supported UI locales for the Baladiyati platform.
 *
 * - `en` — English (canonical, also the fallback whenever a translation is missing)
 * - `ar` — Arabic (RTL layout)
 * - `fr` — French
 *
 * Stored as the Prisma `UserLocale` enum (uppercase) and exposed to clients
 * as lowercase IETF tags. Use `toApiLocale` / `fromApiLocale` to convert.
 */
export type Locale = 'en' | 'ar' | 'fr';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'ar', 'fr'] as const;

export const DEFAULT_LOCALE: Locale = 'en';

/** Locales whose script direction is right-to-left. */
export const RTL_LOCALES: readonly Locale[] = ['ar'] as const;

export function isRtl(locale: Locale): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Pick the best translation from a record that carries optional Ar/Fr fields
 * alongside the canonical `name` (or `description`, etc.).
 *
 * Used to render Municipality / Department / Category / Role names. Falls
 * back to the English/canonical value when a translation is missing rather
 * than showing an empty string — gov UIs must always show *something* sane.
 */
export interface Translatable {
  name?: string | null;
  nameAr?: string | null;
  nameFr?: string | null;
}

export function pickName(item: Translatable | null | undefined, locale: Locale): string {
  if (!item) return '';
  if (locale === 'ar' && item.nameAr) return item.nameAr;
  if (locale === 'fr' && item.nameFr) return item.nameFr;
  return item.name ?? '';
}

export interface TranslatableDescription {
  description?: string | null;
  descriptionAr?: string | null;
  descriptionFr?: string | null;
}

export function pickDescription(
  item: TranslatableDescription | null | undefined,
  locale: Locale,
): string {
  if (!item) return '';
  if (locale === 'ar' && item.descriptionAr) return item.descriptionAr;
  if (locale === 'fr' && item.descriptionFr) return item.descriptionFr;
  return item.description ?? '';
}

/**
 * Generic localized field picker.
 *
 * Looks up `<field><LocaleSuffix>` (e.g. `titleAr`) on the entity, falls
 * back to `<field>` (canonical/English), then to the optional fallback,
 * and finally to "N/A". Use for any DB entity that follows the
 * convention of `field`, `fieldAr`, `fieldFr`.
 *
 * Example:
 *   getLocalizedValue(news, 'title', locale)        // "Public meeting"
 *   getLocalizedValue(category, 'description', locale, '—')
 */
export function getLocalizedValue<T extends Record<string, any>>(
  entity: T | null | undefined,
  field: string,
  locale: Locale,
  fallback: string = 'N/A',
): string {
  if (!entity) return fallback;
  const cap = field.charAt(0).toUpperCase() + field.slice(1);
  if (locale === 'ar' && entity[`${field}Ar`]) return entity[`${field}Ar`];
  if (locale === 'fr' && entity[`${field}Fr`]) return entity[`${field}Fr`];
  if (entity[field]) return entity[field];
  // Allow "title" + "titleEn" style as well
  if (entity[`${field}En`]) return entity[`${field}En`];
  if (entity[`${field}${cap}`]) return entity[`${field}${cap}`];
  return fallback;
}

/** API exposes locale as lowercase IETF tag. */
export function toApiLocale(prismaLocale: 'EN' | 'AR' | 'FR'): Locale {
  return prismaLocale.toLowerCase() as Locale;
}

export function fromApiLocale(locale: Locale): 'EN' | 'AR' | 'FR' {
  return locale.toUpperCase() as 'EN' | 'AR' | 'FR';
}
