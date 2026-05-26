import { ApiError } from './client';
import type { MessageKey } from '../i18n/messages';

export type ErrorPresentation = {
  titleKey: MessageKey;
  message: string;
  isNetwork: boolean;
  status?: number;
};

/** True only for transport failures — not HTTP 4xx/5xx from the API. */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof ApiError) return false;
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('network error') ||
      msg.includes('timeout')
    );
  }
  return false;
}

export function formatApiErrorMessage(err: unknown, t: (k: MessageKey) => string): string {
  return getErrorPresentation(err, t).message;
}

/**
 * Map API / transport errors to user-facing copy.
 * 403/404 and other HTTP errors must never read as "no internet".
 */
export function getErrorPresentation(
  err: unknown,
  t: (k: MessageKey) => string,
): ErrorPresentation {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return {
        titleKey: 'errors.forbidden.title',
        message: err.message || t('errors.forbidden.message'),
        isNetwork: false,
        status: 403,
      };
    }
    if (err.status === 404) {
      return {
        titleKey: 'errors.notFound.title',
        message: err.message || t('errors.notFound.message'),
        isNetwork: false,
        status: 404,
      };
    }
    if (err.status === 409) {
      return {
        titleKey: 'errors.conflict.title',
        message: err.message || t('errors.conflict.message'),
        isNetwork: false,
        status: 409,
      };
    }
    if (err.status === 401) {
      return {
        titleKey: 'errors.unauthorized.title',
        message: err.message || t('errors.unauthorized.message'),
        isNetwork: false,
        status: 401,
      };
    }
    if (err.details?.length) {
      return {
        titleKey: 'common.error',
        message: err.details.map((d) => `• ${d.message}`).join('\n'),
        isNetwork: false,
        status: err.status,
      };
    }
    return {
      titleKey: 'common.error',
      message: err.message || t('errors.server.message'),
      isNetwork: false,
      status: err.status,
    };
  }

  if (isNetworkError(err)) {
    return {
      titleKey: 'errors.network.title',
      message: t('errors.network.message'),
      isNetwork: true,
    };
  }

  if (err instanceof Error && err.message) {
    return {
      titleKey: 'common.error',
      message: err.message,
      isNetwork: false,
    };
  }

  return {
    titleKey: 'errors.server.title',
    message: t('errors.server.message'),
    isNetwork: false,
  };
}
