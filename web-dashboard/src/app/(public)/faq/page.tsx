'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslate } from '@/lib/i18n';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

const FAQ_KEYS = [1, 2, 3, 4, 5, 6] as const;

export default function FaqPage() {
  const t = useTranslate();
  const [open, setOpen] = useState<number | null>(1);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t('public.faq.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('public.faq.subtitle')}</p>
      </div>

      <div className="space-y-2">
        {FAQ_KEYS.map((n) => (
          <div key={n} className="overflow-hidden rounded border border-gray-200 bg-white">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
              onClick={() => setOpen(open === n ? null : n)}
            >
              <div className="flex items-start gap-2.5">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <span className="text-sm font-semibold text-gray-900">
                  {t(`public.faq.q${n}` as any)}
                </span>
              </div>
              {open === n ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
              )}
            </button>
            {open === n && (
              <div className="border-t border-gray-100 px-5 py-4 ps-11">
                <p className="text-sm leading-relaxed text-gray-600">
                  {t(`public.faq.a${n}` as any)}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-10 rounded border border-brand-100 bg-brand-50 p-6 text-center">
        <p className="text-sm font-semibold text-gray-900">{t('public.faq.stillNeedHelp')}</p>
        <Link href="/contact" className="btn-gov-primary mt-4 mx-auto">
          {t('public.faq.contactUs')}
        </Link>
      </div>
    </div>
  );
}
