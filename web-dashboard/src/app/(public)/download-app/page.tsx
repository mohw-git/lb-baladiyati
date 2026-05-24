'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslate } from '@/lib/i18n';
import { platformApi, PlatformBranding } from '@/lib/api/endpoints/platform';
import { Smartphone, Globe } from 'lucide-react';

export default function DownloadAppPage() {
  const t = useTranslate();

  const { data: branding } = useQuery<PlatformBranding>({
    queryKey: ['public-platform-branding'],
    queryFn: () => platformApi.getBranding(),
    staleTime: 10 * 60 * 1000,
  });

  const appStoreUrl = branding?.appStoreUrl;
  const googlePlayUrl = branding?.googlePlayUrl;
  const apkUrl = branding?.apkUrl;
  const hasLinks = appStoreUrl || googlePlayUrl || apkUrl;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <div className="flex justify-center mb-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-brand-200 bg-brand-50">
          <Smartphone className="h-8 w-8 text-brand-700" />
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">{t('public.download.title')}</h1>
      <p className="mt-2 text-sm text-gray-500">{t('public.download.subtitle')}</p>

      {hasLinks ? (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {appStoreUrl && (
            <a
              href={appStoreUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
            >
              <Smartphone className="h-4 w-4" />
              {t('public.download.appStore')}
            </a>
          )}
          {googlePlayUrl && (
            <a
              href={googlePlayUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
            >
              <Smartphone className="h-4 w-4" />
              {t('public.download.googlePlay')}
            </a>
          )}
          {apkUrl && (
            <a
              href={apkUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded border border-brand-200 bg-brand-50 px-6 py-3 text-sm font-semibold text-brand-800 hover:bg-brand-100"
            >
              <Globe className="h-4 w-4" />
              {t('public.download.apk')}
            </a>
          )}
        </div>
      ) : (
        <p className="mt-8 text-sm text-gray-400 italic">{t('public.download.notAvailable')}</p>
      )}
    </div>
  );
}
