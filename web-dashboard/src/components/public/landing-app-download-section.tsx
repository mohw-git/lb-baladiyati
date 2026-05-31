'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslate } from '@/lib/i18n';
import { StoreBadgeImage } from '@/components/public/store-badge-image';
import type { AppDownloadBranding } from '@/components/public/app-download-section';

const LANDING_BADGE_HEIGHT = 48;
const QR_SIZE = 120;

function trimUrl(value?: string | null): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

interface LandingAppDownloadSectionProps {
  branding?: AppDownloadBranding | null;
}

/**
 * Unified download card for the public homepage (dark navy band).
 */
export function LandingAppDownloadSection({ branding }: LandingAppDownloadSectionProps) {
  const t = useTranslate();

  const appStoreUrl = trimUrl(branding?.appStoreUrl);
  const googlePlayUrl = trimUrl(branding?.googlePlayUrl);
  const apkDownloadUrl = trimUrl(branding?.apkUrl);

  const showQr = Boolean(apkDownloadUrl);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="rounded-lg border border-white/12 bg-white/[0.04] p-5 shadow-lg backdrop-blur-sm sm:p-7">
        {/* Header */}
        <header className="text-center lg:text-start">
          <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
            {t('public.download.title')}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-[13px] leading-relaxed text-white/65 sm:text-sm lg:mx-0">
            {t('public.download.subtitle')}
          </p>
        </header>

        {/* Body: stores + optional QR */}
        <div
          className={`mt-6 flex flex-col gap-6 ${
            showQr ? 'lg:flex-row lg:items-center lg:gap-8' : ''
          }`}
        >
          {/* Primary: store badges */}
          <div className={showQr ? 'flex-1' : ''}>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center sm:gap-6 lg:justify-start">
              <StoreBadgeSlot
                url={appStoreUrl}
                kind="app-store"
                label={t('public.download.appStore')}
                comingSoonLabel={t('public.download.storeComingSoon')}
              />
              <StoreBadgeSlot
                url={googlePlayUrl}
                kind="google-play"
                label={t('public.download.googlePlay')}
                comingSoonLabel={t('public.download.storeComingSoon')}
              />
            </div>
          </div>

          {showQr && (
            <>
              {/* Divider — desktop */}
              <div
                className="hidden shrink-0 flex-col items-center justify-center gap-2 lg:flex"
                aria-hidden
              >
                <div className="h-px w-12 bg-white/15" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {t('public.download.orDivider')}
                </span>
                <div className="h-px w-12 bg-white/15" />
              </div>

              {/* Mobile divider */}
              <p className="text-center text-xs font-medium text-white/45 lg:hidden">
                {t('public.download.orScanQr')}
              </p>

              {/* Secondary: APK QR — vertical stack */}
              <aside className="mx-auto w-full max-w-[210px] shrink-0 lg:mx-0">
                <div className="flex flex-col items-center rounded-md border border-white/10 bg-white/[0.06] px-4 py-4 text-center">
                  <div className="rounded bg-white p-1.5 shadow-sm">
                    <QRCodeSVG
                      value={apkDownloadUrl!}
                      size={QR_SIZE}
                      level="M"
                      marginSize={1}
                      aria-label={t('public.download.scanApk')}
                    />
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-snug text-white">
                    {t('public.download.scanApk')}
                  </p>
                  <Link
                    href={apkDownloadUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 inline-flex items-center justify-center rounded border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
                  >
                    {t('public.download.apk')}
                  </Link>
                </div>
              </aside>
            </>
          )}

          {!showQr && (
            <p className="text-center text-xs text-white/45 lg:text-start">
              {t('public.download.apkComingSoon')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StoreBadgeSlot({
  url,
  kind,
  label,
  comingSoonLabel,
}: {
  url?: string;
  kind: 'app-store' | 'google-play';
  label: string;
  comingSoonLabel: string;
}) {
  const badge = (
    <span className="inline-flex h-12 items-end">
      <StoreBadgeImage
        kind={kind}
        onDarkBackground
        height={LANDING_BADGE_HEIGHT}
      />
    </span>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className="inline-flex flex-col items-center gap-1.5 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
      >
        {badge}
      </a>
    );
  }

  return (
    <div
      className="inline-flex flex-col items-center gap-1.5 opacity-45"
      aria-disabled
      title={comingSoonLabel}
    >
      <div className="pointer-events-none select-none grayscale">{badge}</div>
      <span className="text-[10px] font-medium uppercase tracking-wide text-white/50">
        {comingSoonLabel}
      </span>
    </div>
  );
}
