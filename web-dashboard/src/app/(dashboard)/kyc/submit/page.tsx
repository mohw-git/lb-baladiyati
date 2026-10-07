'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CitizenKycCard } from '@/components/kyc/citizen-kyc-card';
import { useTranslate, isRtl, useLocale } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth';
import { isCitizenAccount } from '@/lib/auth/user';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Dedicated citizen KYC submission page (reuses profile card + /kyc/submit API). */
export default function KycSubmitPage() {
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (user && !isCitizenAccount(user)) {
      router.replace('/kyc');
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <Link
          href="/profile"
          className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} />
          {t('common.backTo.profile')}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{t('profile.kyc.title')}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{t('profile.kyc.pageSubtitle')}</p>
      </div>
      <CitizenKycCard />
    </div>
  );
}
