'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslate } from '@/lib/i18n';
import { platformApi, PlatformBranding } from '@/lib/api/endpoints/platform';
import { AppDownloadSection, hasAppDownloadConfig } from '@/components/public/app-download-section';
import { Smartphone } from 'lucide-react';

export default function DownloadAppPage() {
  const t = useTranslate();

  const { data: branding, isLoading } = useQuery<PlatformBranding>({
    queryKey: ['public-platform-branding'],
    queryFn: () => platformApi.getBranding(),
    staleTime: 10 * 60 * 1000,
  });

  const configured = hasAppDownloadConfig(branding);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-brand-200 bg-brand-50">
          <Smartphone className="h-8 w-8 text-brand-700" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t('public.download.title')}</h1>
        <p className="mt-2 text-sm text-gray-500">{t('public.download.subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <AppDownloadSection branding={branding} variant="light" showHeading={false} />
          {!configured && (
            <p className="mt-6 border-t border-gray-100 pt-6 text-center text-sm text-gray-400 italic">
              {t('public.download.notAvailable')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
