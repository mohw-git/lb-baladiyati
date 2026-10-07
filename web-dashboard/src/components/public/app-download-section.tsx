'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslate } from '@/lib/i18n';
import { Smartphone } from 'lucide-react';
import { StoreBadgeImage } from '@/components/public/store-badge-image';
import { STORE_BADGE_HEIGHT_PX } from '@/lib/store-badges';

export interface AppDownloadBranding {
  appStoreUrl?: string | null;
  googlePlayUrl?: string | null;
  /** Android APK direct download URL (platform branding `apkUrl`). */
  apkUrl?: string | null;
}

interface AppDownloadSectionProps {
  branding?: AppDownloadBranding | null;
  /** Dark band on homepage vs light standalone page */
  variant?: 'dark' | 'light';
  /** Show section heading (default true) */
  showHeading?: boolean;
  className?: string;
}

function trimUrl(value?: string | null): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

export function AppDownloadSection({
  branding,
  variant = 'dark',
  showHeading = true,
  className = '',
}: AppDownloadSectionProps) {
  const t = useTranslate();

  const appStoreUrl = trimUrl(branding?.appStoreUrl);
  const googlePlayUrl = trimUrl(branding?.googlePlayUrl);
  const apkDownloadUrl = trimUrl(branding?.apkUrl);

  const hasStoreLink = Boolean(appStoreUrl || googlePlayUrl);
  const isDark = variant === 'dark';

  return (
    <div
      className={`flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between ${className}`}
    >
      {showHeading && (
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded border ${
              isDark ? 'border-white/20 bg-white/5' : 'border-gray-200 bg-gray-50'
            }`}
          >
            <Smartphone className={`h-5 w-5 ${isDark ? 'text-white' : 'text-navy-700'}`} />
          </div>
          <div>
            <h2
              className={`text-base font-bold sm:text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              {t('public.download.title')}
            </h2>
            <p
              className={`mt-1 max-w-md text-xs sm:text-[13px] ${
                isDark ? 'text-white/60' : 'text-gray-500'
              }`}
            >
              {t('public.download.subtitle')}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
        {/* Store badges */}
        <div
          className="flex flex-wrap items-center gap-3"
          style={{ minHeight: STORE_BADGE_HEIGHT_PX }}
        >
          {appStoreUrl ? (
            <a
              href={appStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-end transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              aria-label={t('public.download.appStore')}
            >
              <StoreBadgeImage kind="app-store" onDarkBackground={isDark} height={48} />
            </a>
          ) : null}
          {googlePlayUrl ? (
            <a
              href={googlePlayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-end transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
              aria-label={t('public.download.googlePlay')}
            >
              <StoreBadgeImage kind="google-play" height={48} />
            </a>
          ) : null}
          {!hasStoreLink && (
            <p className={`text-xs italic ${isDark ? 'text-white/50' : 'text-gray-400'}`}>
              {t('public.download.storesComingSoon')}
            </p>
          )}
        </div>

        {/* APK QR */}
        <div
          className={`flex items-center gap-4 rounded-md border px-4 py-3 ${
            isDark ? 'border-white/15 bg-white/5' : 'border-gray-200 bg-gray-50'
          }`}
        >
          {apkDownloadUrl ? (
            <>
              <div className="shrink-0 rounded bg-white p-1.5 shadow-sm">
                <QRCodeSVG
                  value={apkDownloadUrl}
                  size={160}
                  level="M"
                  marginSize={1}
                  aria-label={t('public.download.scanApk')}
                />
              </div>
              <div className="min-w-0 max-w-[200px]">
                <p
                  className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}
                >
                  {t('public.download.scanApk')}
                </p>
                <Link
                  href={apkDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-1 block truncate text-xs underline-offset-2 hover:underline ${
                    isDark ? 'text-brand-200' : 'text-brand-700'
                  }`}
                >
                  {t('public.download.apk')}
                </Link>
              </div>
            </>
          ) : (
            <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
              {t('public.download.apkComingSoon')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** True when any download URL is configured in platform branding. */
export function hasAppDownloadConfig(branding?: AppDownloadBranding | null): boolean {
  return Boolean(
    trimUrl(branding?.appStoreUrl) ||
      trimUrl(branding?.googlePlayUrl) ||
      trimUrl(branding?.apkUrl),
  );
}
