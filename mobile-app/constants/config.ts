import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  DEV_DEFAULT_API_URL,
  isUnsafeApiUrl,
  PRODUCTION_API_URL,
} from '../lib/config/api-url';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiUrl?: string;
  apiBuildProfile?: string;
};

const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const extraApiUrl = extra.apiUrl?.trim();
const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];

function buildDevUrl(): string {
  const host = expoHost || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
  return `http://${host}:3000`;
}

/**
 * API URL resolution:
 * - __DEV__ (Expo Go / dev client): .env / extra / Metro host / emulator host — localhost OK.
 * - Release APK (preview/production): extra.apiUrl from app.config.ts wins over inlined .env
 *   so a developer's gitignored .env cannot override EAS preview/production.
 */
function resolveApiUrl(): string {
  if (__DEV__) {
    return envApiUrl || extraApiUrl || buildDevUrl() || DEV_DEFAULT_API_URL;
  }

  // Release: prefer EAS-validated extra.apiUrl over Metro-inlined EXPO_PUBLIC_* from local .env
  if (extraApiUrl && !isUnsafeApiUrl(extraApiUrl)) {
    return extraApiUrl;
  }
  if (envApiUrl && !isUnsafeApiUrl(envApiUrl)) {
    return envApiUrl;
  }

  return extraApiUrl || envApiUrl || '';
}

const resolvedApiUrl = resolveApiUrl();

if (!__DEV__) {
  if (!resolvedApiUrl || isUnsafeApiUrl(resolvedApiUrl)) {
    throw new Error(
      `[config] Release build has invalid API_URL "${resolvedApiUrl || '(empty)'}". ` +
        `Rebuild with EAS profile preview or production (expected ${PRODUCTION_API_URL}). ` +
        `extra.apiUrl=${extraApiUrl ?? '(missing)'}, inlined env=${envApiUrl ?? '(missing)'}.`,
    );
  }
}

export const API_URL: string = resolvedApiUrl;

if (__DEV__ && !API_URL) {
  console.warn(
    '[config] No API URL configured. Set EXPO_PUBLIC_API_URL in .env or use Expo dev host.',
  );
}

/** Public web portal (password reset, contact). Override with EXPO_PUBLIC_WEB_URL. */
export const WEB_PORTAL_URL: string =
  process.env.EXPO_PUBLIC_WEB_URL?.trim() || 'https://lb-baladiyati.com';

export const WEB_FORGOT_PASSWORD_URL = `${WEB_PORTAL_URL.replace(/\/$/, '')}/forgot-password`;
export const WEB_CONTACT_URL = `${WEB_PORTAL_URL.replace(/\/$/, '')}/contact`;
