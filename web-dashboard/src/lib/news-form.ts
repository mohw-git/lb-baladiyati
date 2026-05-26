import type { MessageKey } from '@/lib/i18n/messages';

/** Mirrors backend CreateNewsDto / UpdateNewsDto length rules. */
export const NEWS_TITLE_MIN = 5;
export const NEWS_TITLE_MAX = 200;
export const NEWS_CONTENT_MIN = 10;

type Translate = (key: MessageKey) => string;

export function trimNewsFields(title: string, content: string) {
  return { title: title.trim(), content: content.trim() };
}

/** Returns a bullet-list message for toast display, or null when valid. */
export function validateNewsFields(
  title: string,
  content: string,
  t: Translate,
): string | null {
  const issues: string[] = [];
  if (!title) {
    issues.push(`• ${t('news.validation.titleRequired')}`);
  } else if (title.length < NEWS_TITLE_MIN) {
    issues.push(`• ${t('news.hint.titleMin')}`);
  } else if (title.length > NEWS_TITLE_MAX) {
    issues.push(`• ${t('news.hint.titleMax')}`);
  }
  if (!content) {
    issues.push(`• ${t('news.validation.contentRequired')}`);
  } else if (content.length < NEWS_CONTENT_MIN) {
    issues.push(`• ${t('news.hint.contentMin')}`);
  }
  return issues.length ? issues.join('\n') : null;
}
