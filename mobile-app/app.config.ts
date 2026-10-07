import type { ConfigContext, ExpoConfig } from 'expo/config';
import { resolveApiUrlForExpoConfig } from './lib/config/api-url.cjs';

/**
 * Dynamic Expo config — merges app.json and sets API URL per build profile.
 * Preview/production EAS builds always embed a safe production API URL in extra.apiUrl,
 * ignoring unsafe values from a developer's local .env.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  const appVariant = process.env.APP_VARIANT;
  const isProductionProfile =
    buildProfile === 'production' || appVariant === 'production';
  const isPreviewProfile = buildProfile === 'preview';

  const apiUrl = resolveApiUrlForExpoConfig({
    buildProfile,
    appVariant,
    envApiUrl: process.env.EXPO_PUBLIC_API_URL,
    extraApiUrl: (config.extra as { apiUrl?: string } | undefined)?.apiUrl,
  });

  const sentryDsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ||
    (config.extra as { sentryDsn?: string } | undefined)?.sentryDsn ||
    '';

  return {
    ...config,
    name: config.name ?? 'Baladiyati',
    slug: config.slug ?? 'baladi-mobile',
    extra: {
      ...(config.extra ?? {}),
      apiUrl,
      apiBuildProfile: buildProfile ?? (appVariant === 'production' ? 'production' : undefined),
      sentryDsn,
      sentryEnvironment:
        isProductionProfile || isPreviewProfile ? 'production' : 'development',
    },
  } as ExpoConfig;
};
