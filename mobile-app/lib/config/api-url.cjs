/** @typedef {{ buildProfile?: string; appVariant?: string; envApiUrl?: string; extraApiUrl?: string }} ResolveOptions */

/** Canonical production API — must match eas.json preview/production env. */
const PRODUCTION_API_URL = 'https://api.lb-baladiyati.com';

const DEV_DEFAULT_API_URL = 'http://localhost:3000';

const RELEASE_EAS_PROFILES = new Set(['preview', 'production']);

/** Local / emulator hosts that must never ship in preview or production APKs. */
function isUnsafeApiUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return true;
  return /(?:^|\/\/)(localhost|127\.0\.0\.1|10\.0\.2\.2|0\.0\.0\.0)(?::\d+)?/i.test(trimmed);
}

function isReleaseEasProfile(buildProfile) {
  return !!buildProfile && RELEASE_EAS_PROFILES.has(buildProfile);
}

/**
 * Resolve API URL for app.config.ts (Node, at EAS / expo prebuild).
 * Preview/production always get a safe HTTPS URL; development keeps localhost.
 * @param {ResolveOptions} options
 */
function resolveApiUrlForExpoConfig(options) {
  const { buildProfile, appVariant, envApiUrl, extraApiUrl } = options;
  const isRelease =
    isReleaseEasProfile(buildProfile) || appVariant === 'production';

  if (isRelease) {
    const fromEnv = envApiUrl?.trim() ?? '';
    const candidate =
      fromEnv && !isUnsafeApiUrl(fromEnv) ? fromEnv : PRODUCTION_API_URL;

    if (!candidate || isUnsafeApiUrl(candidate)) {
      throw new Error(
        `[app.config] ${buildProfile ?? 'release'} build requires a non-localhost API URL. ` +
          `Set EXPO_PUBLIC_API_URL=${PRODUCTION_API_URL} in eas.json (got "${fromEnv || '(empty)'}").`,
      );
    }
    return candidate;
  }

  const fromEnv = envApiUrl?.trim();
  if (fromEnv) return fromEnv;
  const fromExtra = extraApiUrl?.trim();
  if (fromExtra) return fromExtra;
  return DEV_DEFAULT_API_URL;
}

module.exports = {
  PRODUCTION_API_URL,
  DEV_DEFAULT_API_URL,
  isUnsafeApiUrl,
  isReleaseEasProfile,
  resolveApiUrlForExpoConfig,
};
