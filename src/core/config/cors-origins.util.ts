/**
 * Shared CORS origin resolution for HTTP (main.ts) and Socket.IO (/realtime).
 * Reads process.env at call time so values are available after ConfigModule loads .env.
 */

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:19000',
];

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

function isLocalhostOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(:\d+)?$/i.test(
    origin.replace(/\/$/, ''),
  );
}

function isHttpsOrigin(origin: string): boolean {
  return /^https:\/\//i.test(origin.replace(/\/$/, ''));
}

function isLanOrigin(origin: string): boolean {
  if (isProductionEnv()) return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)(:\d+)?$/.test(
    origin.replace(/\/$/, ''),
  );
}

/** Normalized allowlist used by HTTP CORS and Socket.IO. */
export function resolveCorsOrigins(): string[] {
  const isProduction = isProductionEnv();
  const frontendUrl = process.env.FRONTEND_URL?.trim();
  const explicitOrigins = process.env.CORS_ORIGINS?.trim();

  let origins = (
    explicitOrigins
      ? explicitOrigins.split(',')
      : frontendUrl
        ? [frontendUrl, ...(isProduction ? [] : DEFAULT_DEV_ORIGINS)]
        : isProduction
          ? []
          : DEFAULT_DEV_ORIGINS
  )
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (isProduction) {
    origins = origins.filter((origin) => {
      if (isLocalhostOrigin(origin)) return false;
      if (!isHttpsOrigin(origin) && origin !== '*') return false;
      return true;
    });
  }

  return origins;
}

/** Returns true when the Origin header should be accepted (no origin = mobile/curl). */
export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const normalized = origin.replace(/\/$/, '');
  const allowlist = resolveCorsOrigins();
  if (allowlist.includes('*')) return true;
  if (allowlist.includes(normalized)) return true;
  if (isLanOrigin(normalized)) return true;
  return false;
}

export function buildSocketIoCorsOptions(): {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => void;
  credentials: boolean;
} {
  return {
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`), false);
      }
    },
    credentials: true,
  };
}
