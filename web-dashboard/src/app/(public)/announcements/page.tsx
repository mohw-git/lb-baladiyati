'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, ChevronRight, Search } from 'lucide-react';
import { platformAnnouncementsApi } from '@/lib/api/endpoints/platform-announcements';
import { useTranslate, useLocale } from '@/lib/i18n';
import { getLocalizedValue } from '@shared/types/locale';
import { resolveBrandMediaUrl } from '@/lib/municipality-branding';
import { formatDate } from '@/lib/utils';

export default function PublicAnnouncementsPage() {
  const t = useTranslate();
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['platform-announcements-public', page, search],
    queryFn: () =>
      platformAnnouncementsApi.listPublic({
        page,
        limit: 12,
        search: search.trim() || undefined,
      }),
    staleTime: 2 * 60 * 1000,
  });

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-gray-200 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {t('public.section.announcements')}
        </p>
        <h1 className="text-2xl font-bold text-navy-950">{t('public.announcements.title')}</h1>
      </header>

      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t('public.announcements.searchPlaceholder')}
            className="input-gov w-full ps-9"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-gray-500">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <div className="rounded border border-gray-200 bg-white p-10 text-center">
          <Megaphone className="mx-auto mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm text-gray-500">{t('public.announcements.empty')}</p>
          <Link href="/" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            {t('common.back')}
            <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
          </Link>
        </div>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2">
            {items.map((item) => {
              const title = getLocalizedValue(item, 'title', locale, '');
              const summary = getLocalizedValue(item, 'summary', locale, '');
              const imageSrc = resolveBrandMediaUrl(item.imageUrl);
              return (
                <li key={item.id}>
                  <Link
                    href={`/announcements/${item.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="relative h-36 bg-navy-900">
                      {imageSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageSrc} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-navy-800 to-navy-950" />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        {formatDate(item.publishAt || item.createdAt)}
                      </p>
                      <h2 className="mt-1 text-base font-bold text-navy-950 group-hover:text-brand-700">
                        {title}
                      </h2>
                      <p className="mt-2 line-clamp-2 flex-1 text-sm text-gray-600">{summary}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                        {t('public.announcements.readMore')}
                        <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {data?.meta && data.meta.totalPages > 1 ? (
            <div className="mt-6 flex justify-center gap-2">
              <button
                type="button"
                disabled={!data.meta.hasPrevPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-gov-secondary text-xs disabled:opacity-40"
              >
                {t('common.previous')}
              </button>
              <span className="flex items-center text-xs text-gray-500">
                {page} / {data.meta.totalPages}
              </span>
              <button
                type="button"
                disabled={!data.meta.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="btn-gov-secondary text-xs disabled:opacity-40"
              >
                {t('common.next')}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
