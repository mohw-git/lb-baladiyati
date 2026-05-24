'use client';

import { useAuth } from '@/lib/auth';
import { ShieldAlert } from 'lucide-react';
import { useTranslate } from '@/lib/i18n';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const t = useTranslate();

  if (!user?.isSuperAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <ShieldAlert className="h-16 w-16 text-amber-500" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">{t('platform.access.denied')}</h1>
        <p className="mt-2 max-w-md text-gray-600">
          {t('platform.access.denied.message')}
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Cross-municipality control bar — institutional, not generic toast.
         Bold left-stripe, restrained palette, audit reminder. */}
      <div className="relative mb-4 flex items-center gap-3 overflow-hidden rounded border border-amber-300 bg-amber-50/70 px-4 py-2.5 shadow-sm">
        <span className="absolute inset-y-0 start-0 w-1 bg-amber-600" aria-hidden />
        <div className="flex h-8 w-8 items-center justify-center rounded bg-amber-100">
          <ShieldAlert className="h-4 w-4 text-amber-700" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-900 leading-tight">
            {t('platform.banner.title')}
          </p>
          <p className="text-[11px] text-amber-800 leading-tight">
            {t('platform.banner.subtitle')}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}
