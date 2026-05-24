/**
 * Sentry instrumentation.
 *
 * IMPORTANT: This file MUST be imported as the very first thing in `main.ts`
 * — before anything else from the app — so Sentry can patch Node modules
 * before they're used. It is a no-op when SENTRY_DSN is unset, so existing
 * dev workflows are unchanged.
 */
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE ?? process.env.GIT_COMMIT_SHA,
    integrations: [nodeProfilingIntegration()],
    // Capture 10% of transactions for performance monitoring in production;
    // crank to 1.0 during incidents via env. Tracing has overhead, so we
    // keep it deliberately conservative.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '0.1'),
    // Avoid leaking PII into Sentry — we already audit-log what we need.
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip Authorization headers that may have slipped in.
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });
}

export { Sentry };
