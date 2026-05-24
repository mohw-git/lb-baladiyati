'use client';

import Link from 'next/link';
import { useTranslate } from '@/lib/i18n';
import { Megaphone, ChevronRight } from 'lucide-react';

export default function PublicAnnouncementsPage() {
  const t = useTranslate();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-gray-200 pb-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          {t('public.section.announcements')}
        </p>
        <h1 className="text-2xl font-bold text-navy-950">{t('public.announcements.title')}</h1>
      </header>

      <div className="rounded border border-gray-200 bg-white p-10 text-center">
        <Megaphone className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <p className="text-sm text-gray-500">{t('public.announcements.empty')}</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
          {t('common.back')}
          <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
        </Link>
      </div>
    </div>
  );
}
