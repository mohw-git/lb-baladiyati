/**
 * Sentry initialization for the mobile app.
 *
 * Initialised at the very top of the root layout (before any other imports
 * that might throw at module-load time). Picks DSN/env from `expo-constants`
 * `extra` so each build profile (dev/staging/prod) can have a different DSN
 * without touching code.
 *
 * NOTE: We deliberately use the JS-only API. Native crash reporting requires
 * a custom dev client and the Sentry Expo config plugin; we keep this Expo Go
 * compatible.
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

interface SentryExtra {
  sentryDsn?: string;
  sentryEnvironment?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as SentryExtra;
const dsn = extra.sentryDsn || (process.env.EXPO_PUBLIC_SENTRY_DSN as string | undefined);

let initialized = false;

export function initSentry() {
  if (initialized || !dsn) return;
  initialized = true;
  Sentry.init({
    dsn,
    environment: extra.sentryEnvironment ?? (__DEV__ ? 'development' : 'production'),
    tracesSampleRate: 0.1,
    // Don't auto-attach screenshots; they're often noisy and PII-heavy.
    attachScreenshot: false,
    attachViewHierarchy: false,
    sendDefaultPii: false,
    // Skip dev-time JS errors that come from Metro's red-box overlays.
    enabled: !__DEV__,
  });
}

export { Sentry };
