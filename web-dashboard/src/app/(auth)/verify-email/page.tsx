'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi, ApiError } from '@/lib/api';
import { useTranslate } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import {
  MailCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

type State = 'pending' | 'success' | 'failed' | 'missing-token';

/**
 * Consume the verification token from `/verify-email?token=<raw>` and call
 * the backend to mark the email as verified. Single-use on the server side.
 */
function VerifyEmailContent() {
  const t = useTranslate();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>(token ? 'pending' : 'missing-token');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // React Strict Mode mounts components twice in dev; the token is single-use
  // so we must guard against double-invocation.
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    let cancelled = false;
    authApi
      .verifyEmail(token)
      .then(() => {
        if (!cancelled) setState('success');
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) setErrorMessage(err.message);
        setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'missing-token') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <p className="text-sm text-gray-700">{t('auth.verify.missingToken')}</p>
        <Link href="/login" className="btn-gov-secondary inline-flex w-full justify-center">
          {t('auth.forgot.backToLogin')}
        </Link>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <p className="text-sm text-gray-700">{t('auth.verify.pending')}</p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
          <CheckCircle2 className="h-6 w-6 text-success-700" />
        </div>
        <p className="text-sm text-gray-700">{t('auth.verify.success')}</p>
        <button
          type="button"
          onClick={() => router.replace('/dashboard')}
          className="btn-gov-primary w-full justify-center"
        >
          {t('auth.verify.continue')}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // state === 'failed'
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-600" />
      </div>
      <p className="text-sm text-gray-700">{errorMessage ?? t('auth.verify.failed')}</p>
      <Link
        href="/login"
        className="btn-gov-secondary inline-flex w-full justify-center"
      >
        {t('auth.forgot.backToLogin')}
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  const t = useTranslate();
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <div className="border-b border-gray-200 bg-navy-900 px-4 py-2">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <span className="text-xs text-navy-300">{t('landing.topbar.email')}</span>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded bg-brand-700 shadow">
              <MailCheck className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">{t('auth.verify.title')}</h1>
          </div>

          <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
            <Suspense fallback={<Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />}>
              <VerifyEmailContent />
            </Suspense>
          </div>

          <p className="mt-4 text-center text-[10px] text-gray-400">
            {t('common.appName')} · {t('common.tagline')}
          </p>
        </div>
      </div>
    </div>
  );
}
