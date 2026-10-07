'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { get } from '@/lib/api/client';
import type { NewsArticle } from '@shared/types/news';
import { ChevronRight, Megaphone } from 'lucide-react';
import { platformAnnouncementsApi } from '@/lib/api/endpoints/platform-announcements';
import { useTranslate, useLocale } from '@/lib/i18n';
import { getLocalizedValue } from '@shared/types/locale';
import { resolveBrandMediaUrl } from '@/lib/municipality-branding';
import { formatDate } from '@/lib/utils';

export default function PublicAnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const municipalityId = searchParams.get('municipalityId') || undefined;
  const t = useTranslate();
  const locale = useLocale();

  const platformQuery = useQuery({
    queryKey: ['platform-announcement-public', id],
    queryFn: () => platformAnnouncementsApi.getPublic(id),
    enabled: !!id,
    retry: false,
  });

  const newsQuery = useQuery({
    queryKey: ['news-public', id, municipalityId],
    queryFn: () =>
      get<NewsArticle>(`/news/${id}?municipalityId=${encodeURIComponent(municipalityId!)}`, {
        skipAuth: true,
      }),
    enabled: !!id && platformQuery.isError && !!municipalityId,
    retry: false,
  });

  const isLoading = platformQuery.isLoading || (platformQuery.isError && !!municipalityId && newsQuery.isLoading);
  const item = platformQuery.data
    ? {
        title: platformQuery.data.title,
        titleAr: platformQuery.data.titleAr,
        titleFr: platformQuery.data.titleFr,
        content: platformQuery.data.content,
        contentAr: platformQuery.data.contentAr,
        contentFr: platformQuery.data.contentFr,
        imageUrl: platformQuery.data.imageUrl,
        publishAt: platformQuery.data.publishAt,
        createdAt: platformQuery.data.createdAt,
      }
    : newsQuery.data
      ? {
          title: newsQuery.data.title,
          titleAr: (newsQuery.data as { titleAr?: string }).titleAr,
          titleFr: (newsQuery.data as { titleFr?: string }).titleFr,
          content: newsQuery.data.content,
          contentAr: (newsQuery.data as { contentAr?: string }).contentAr,
          contentFr: (newsQuery.data as { contentFr?: string }).contentFr,
          imageUrl: newsQuery.data.coverImageUrl,
          publishAt: newsQuery.data.publishedAt,
          createdAt: newsQuery.data.createdAt,
        }
      : null;

  const isError = platformQuery.isError && (!municipalityId || newsQuery.isError);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-gray-500">
        {t('common.loading')}
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <Megaphone className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">{t('public.announcements.notFound')}</p>
        <Link href="/announcements" className="mt-4 inline-block text-xs font-semibold text-brand-700 hover:underline">
          {t('public.announcements.backToList')}
        </Link>
      </div>
    );
  }

  const title = getLocalizedValue(item, 'title', locale, '');
  const content = getLocalizedValue(item, 'content', locale, '');
  const imageSrc = resolveBrandMediaUrl(item.imageUrl);

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/announcements"
        className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
      >
        <ChevronRight className="h-3.5 w-3.5 rotate-180 rtl:rotate-0" />
        {t('public.announcements.backToList')}
      </Link>

      {imageSrc ? (
        <div className="mb-6 overflow-hidden rounded-md border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="" className="max-h-80 w-full object-cover" />
        </div>
      ) : null}

      <header className="border-b border-gray-200 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
          {formatDate(item.publishAt || item.createdAt)}
        </p>
        <h1 className="mt-2 text-2xl font-bold text-navy-950 sm:text-3xl">{title}</h1>
      </header>

      <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{content}</div>
    </article>
  );
}
