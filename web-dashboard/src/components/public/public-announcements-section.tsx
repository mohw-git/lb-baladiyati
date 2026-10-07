'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Megaphone } from 'lucide-react';
import { platformAnnouncementsApi } from '@/lib/api/endpoints/platform-announcements';
import { AnnouncementsCarousel } from '@/components/public/announcements-carousel';
import { useTranslate, useLocale } from '@/lib/i18n';

export function PublicAnnouncementsSection() {
  const t = useTranslate();
  const locale = useLocale();

  const { data } = useQuery({
    queryKey: ['platform-announcements-public', { limit: 5 }],
    queryFn: () => platformAnnouncementsApi.listPublic({ page: 1, limit: 5 }),
    staleTime: 5 * 60 * 1000,
  });

  const items = data?.items ?? [];

  return (
    <section className="border-b border-gray-200 bg-gray-50 py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-end justify-between border-s-4 border-s-emerald-600 ps-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {t('public.section.announcements')}
            </p>
            <h2 className="text-lg font-bold text-navy-950 sm:text-xl">
              {t('public.announcements.latestTitle')}
            </h2>
          </div>
          <Link
            href="/announcements"
            className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
          >
            {t('common.viewAll')}
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </header>

        {items.length > 0 ? (
          <AnnouncementsCarousel
            items={items}
            locale={locale}
            readMoreLabel={t('public.announcements.readMore')}
          />
        ) : (
          <div className="rounded-md border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
            <Megaphone className="mx-auto mb-3 h-8 w-8 text-gray-300" />
            {t('public.announcements.empty')}
          </div>
        )}
      </div>
    </section>
  );
}
