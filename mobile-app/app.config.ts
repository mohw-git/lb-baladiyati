import type { ConfigContext, ExpoConfig } from 'expo/config';

const PRODUCTION_API_URL = 'https://api.lb-baladiyati.com';
const DEV_DEFAULT_API_URL = 'http://localhost:3000';

function isUnsafeProductionApiUrl(url: string): boolean {
  return /(?:^|\/\/)(localhost|127\.0\.0\.1|10\.0\.2\.2|0\.0\.0\.0)(?::\d+)?/i.test(
    url,
  );
}

/**
 * Dynamic Expo config — merges app.json and sets API URL per build profile.
 * Production EAS builds fail fast if EXPO_PUBLIC_API_URL is missing or localhost.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const buildProfile = process.env.EAS_BUILD_PROFILE;
  const isProductionProfile =
    buildProfile === 'production' ||
    process.env.APP_VARIANT === 'production';

  let apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? '';

  if (!apiUrl) {
    const fromJson = (config.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim();
    apiUrl = fromJson || (isProductionProfile ? PRODUCTION_API_URL : DEV_DEFAULT_API_URL);
  }

  if (isProductionProfile && isUnsafeProductionApiUrl(apiUrl)) {
    throw new Error(
      `Production mobile build requires a non-localhost API URL. ` +
        `Set EXPO_PUBLIC_API_URL=${PRODUCTION_API_URL} in eas.json or EAS env (got "${apiUrl}").`,
    );
  }

  const sentryDsn =
    process.env.EXPO_PUBLIC_SENTRY_DSN?.trim() ||
    (config.extra as { sentryDsn?: string } | undefined)?.sentryDsn ||
    '';

  return {
    ...config,
    name: config.name ?? 'Baladi',
    slug: config.slug ?? 'baladi-mobile',
    extra: {
      ...(config.extra ?? {}),
      apiUrl,
      sentryDsn,
      sentryEnvironment: isProductionProfile ? 'production' : 'development',
    },
  } as ExpoConfig;
};
