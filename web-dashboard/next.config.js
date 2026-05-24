/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['../shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/uploads/**',
      },
    ],
  },
};

// Wrap with Sentry only when NEXT_PUBLIC_SENTRY_DSN is set, so the build keeps
// working for contributors who haven't configured Sentry yet.
const hasSentry = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

if (hasSentry) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { withSentryConfig } = require('@sentry/nextjs');
  module.exports = withSentryConfig(nextConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
  });
} else {
  module.exports = nextConfig;
}
