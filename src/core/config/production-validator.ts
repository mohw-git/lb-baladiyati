/**
 * Production environment validator.
 *
 * Runs once at boot, AFTER ConfigModule has loaded `.env` but BEFORE
 * the Nest app starts listening. When NODE_ENV=production it refuses
 * to start the app if any required value is missing, still set to a
 * placeholder, or unsafe (e.g. localhost URLs, weak JWT_SECRET).
 *
 * In non-production environments the validator only emits warnings
 * so local development isn't disrupted.
 *
 * The intent: it should be impossible to accidentally ship a build
 * to production with a leaked Resend key still in place, or with
 * `JWT_SECRET=your-super-secret-jwt-key-min-32-chars-here`.
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidator');

/** Strings we know are placeholders shipped in our example files. */
const KNOWN_PLACEHOLDERS = [
  'REPLACE_WITH_A_LONG_RANDOM_STRING_AT_LEAST_32_CHARS',
  'REPLACE_WITH_DB_PASSWORD',
  're_REPLACE_WITH_REAL_KEY',
  'REPLACE_ME',
  'change-me',
  'change-me-to-a-long-random-string-min-32-chars',
  'your-super-secret-jwt-key-min-32-chars-here',
  'CHANGE_ME',
  'CHANGE_ME_STRONG_SECRET',
  'CHANGE_ME_DB_PASSWORD',
];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return KNOWN_PLACEHOLDERS.some((p) =>
    trimmed.toLowerCase().includes(p.toLowerCase()),
  );
}

function isLocalhostUrl(value: string | undefined): boolean {
  if (!value) return false;
  return /(?:^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(?::\d+)?(?:\/|$)/i.test(
    value,
  );
}

function isHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;
  return /^https:\/\//i.test(value.trim());
}

interface ValidationProblem {
  key: string;
  message: string;
}

/**
 * Validates the running process's environment for production safety.
 * Returns a list of problems. Empty array means we're good to start.
 */
export function validateProductionEnv(): ValidationProblem[] {
  const problems: ValidationProblem[] = [];
  const env = process.env;

  // ── JWT_SECRET ─────────────────────────────────────────────────
  if (!env.JWT_SECRET) {
    problems.push({ key: 'JWT_SECRET', message: 'is required' });
  } else if (isPlaceholder(env.JWT_SECRET)) {
    problems.push({
      key: 'JWT_SECRET',
      message: 'is still set to a known placeholder — generate a new value',
    });
  } else if (env.JWT_SECRET.length < 32) {
    problems.push({
      key: 'JWT_SECRET',
      message: `must be at least 32 characters (got ${env.JWT_SECRET.length})`,
    });
  }

  // ── DATABASE_URL ────────────────────────────────────────────────
  if (!env.DATABASE_URL) {
    problems.push({ key: 'DATABASE_URL', message: 'is required' });
  } else if (isPlaceholder(env.DATABASE_URL)) {
    problems.push({
      key: 'DATABASE_URL',
      message: 'still contains a placeholder — set a real connection string',
    });
  } else if (/:root@/i.test(env.DATABASE_URL)) {
    problems.push({
      key: 'DATABASE_URL',
      message:
        'uses the postgres `root` user — create a non-superuser role for the app',
    });
  } else if (/postgres:postgres@/i.test(env.DATABASE_URL)) {
    problems.push({
      key: 'DATABASE_URL',
      message:
        'uses the default postgres/postgres credentials — create a dedicated role',
    });
  }

  // ── Public URLs ─────────────────────────────────────────────────
  for (const key of ['APP_PUBLIC_URL', 'API_PUBLIC_URL', 'FRONTEND_URL']) {
    const v = env[key];
    if (!v) {
      problems.push({ key, message: 'is required in production' });
      continue;
    }
    if (isLocalhostUrl(v)) {
      problems.push({
        key,
        message: `must not point to localhost in production (got ${v})`,
      });
    }
    if (!isHttpsUrl(v)) {
      problems.push({
        key,
        message: `must use https:// in production (got ${v})`,
      });
    }
  }

  // ── CORS ────────────────────────────────────────────────────────
  // CORS is fine empty (we fall back to FRONTEND_URL), but if set,
  // every entry must be https and non-localhost.
  if (env.CORS_ORIGINS) {
    const origins = env.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    for (const origin of origins) {
      if (isLocalhostUrl(origin)) {
        problems.push({
          key: 'CORS_ORIGINS',
          message: `contains a localhost origin (${origin}) — remove for production`,
        });
      }
      if (!isHttpsUrl(origin) && origin !== '*') {
        problems.push({
          key: 'CORS_ORIGINS',
          message: `entry ${origin} must use https://`,
        });
      }
    }
  }

  // ── Email provider ──────────────────────────────────────────────
  // Resend is the preferred provider. We require either Resend OR a
  // configured SMTP host so password-reset / verification flows work.
  const hasResend = !!env.RESEND_API_KEY && !isPlaceholder(env.RESEND_API_KEY);
  const hasSmtp = !!env.SMTP_HOST && !isPlaceholder(env.SMTP_HOST);
  if (!hasResend && !hasSmtp) {
    problems.push({
      key: 'RESEND_API_KEY',
      message:
        'is required in production (or configure SMTP_HOST as a fallback)',
    });
  }
  if (env.RESEND_API_KEY && isPlaceholder(env.RESEND_API_KEY)) {
    problems.push({
      key: 'RESEND_API_KEY',
      message: 'is still set to a placeholder — paste the real key',
    });
  }
  if (
    env.RESEND_API_KEY &&
    !isPlaceholder(env.RESEND_API_KEY) &&
    !env.RESEND_API_KEY.startsWith('re_')
  ) {
    problems.push({
      key: 'RESEND_API_KEY',
      message: 'does not look like a Resend key (expected prefix `re_`)',
    });
  }

  // ── Mail identity ──────────────────────────────────────────────
  if (!env.MAIL_FROM || isPlaceholder(env.MAIL_FROM)) {
    problems.push({ key: 'MAIL_FROM', message: 'is required in production' });
  }

  // ── Firebase ───────────────────────────────────────────────────
  // Either a JSON path that exists, or the inline FIREBASE_SERVICE_ACCOUNT JSON.
  const hasFcmFile =
    !!env.FIREBASE_SERVICE_ACCOUNT_PATH &&
    !isPlaceholder(env.FIREBASE_SERVICE_ACCOUNT_PATH);
  const hasFcmInline =
    !!env.FIREBASE_SERVICE_ACCOUNT &&
    !isPlaceholder(env.FIREBASE_SERVICE_ACCOUNT);
  if (!hasFcmFile && !hasFcmInline) {
    problems.push({
      key: 'FIREBASE_SERVICE_ACCOUNT_PATH',
      message:
        'is required in production (or set FIREBASE_SERVICE_ACCOUNT inline)',
    });
  }

  // ── Uploads ────────────────────────────────────────────────────
  // On Windows server we want an absolute path so we don't write
  // user uploads under the deployed app directory by accident.
  if (env.UPLOAD_PATH) {
    const p = env.UPLOAD_PATH;
    const isAbsolute =
      /^[A-Za-z]:[\\/]/.test(p) || p.startsWith('/') || p.startsWith('\\\\');
    if (!isAbsolute) {
      problems.push({
        key: 'UPLOAD_PATH',
        message: `must be an absolute path in production (got ${p})`,
      });
    }
  }

  return problems;
}

/**
 * Public entry point — call once during bootstrap. In production,
 * exits the process with code 1 if anything is wrong. In dev/test,
 * problems are logged as warnings only.
 */
export function assertProductionEnvOrExit(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const problems = validateProductionEnv();
  if (!problems.length) {
    if (isProduction) {
      logger.log('Production environment validated.');
    }
    return;
  }

  const lines = problems.map((p) => `  - ${p.key}: ${p.message}`);
  if (isProduction) {
    logger.error(
      'Refusing to start: production environment is not safe.\n' +
        lines.join('\n') +
        '\nFix the offending values in `.env` (see `.env.production.example`) and restart.',
    );
    process.exit(1);
  } else {
    logger.warn(
      'Production-mode env check would fail with these issues (allowed in dev):\n' +
        lines.join('\n'),
    );
  }
}
