'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/auth/store';
import { authApi } from '@/lib/api';
import { Loader2, ShieldAlert } from 'lucide-react';
import { useTranslate } from '@/lib/i18n';

function ImpersonateContent() {
  const router = useRouter();
  const params = useSearchParams();
  const t = useTranslate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = params.get('token');
    const as = params.get('as');
    if (!token) {
      setError(t('impersonate.missingToken'));
      return;
    }

    (async () => {
      try {
        useAuthStore.setState({
          accessToken: token,
          refreshToken: null,
        });
        const profile = await authApi.getProfile();
        useAuthStore.setState({ user: profile as any });
        sessionStorage.setItem('impersonating', as ?? 'unknown');
        router.replace('/dashboard');
      } catch (e: any) {
        setError(e?.message ?? t('impersonate.failed'));
      }
    })();
  }, [params, router, t]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500" />
        <h1 className="mt-4 text-2xl font-bold text-gray-900">{t('impersonate.failed')}</h1>
        <p className="mt-2 text-gray-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
      <p className="mt-4 text-sm text-gray-600">{t('impersonate.starting')}</p>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
          <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
        </div>
      }
    >
      <ImpersonateContent />
    </Suspense>
  );
}
