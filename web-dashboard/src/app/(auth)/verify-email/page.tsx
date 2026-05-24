'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { authApi, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useTranslate } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import {
  MailCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

type State =
  | 'pending'
  | 'success'
  | 'already-verified'
  | 'failed'
  | 'missing-token';

type ErrorKind = 'invalid' | 'network' | 'rate-limit';

const REDIRECT_MS = 2500;

/**
 * Consume the verification token from `/verify-email?token=<raw>` and call
 * the backend to mark the email as verified. Single-use on the server side,
 * with idempotent handling when the email is already verified.
 */
function VerifyEmailContent() {
  const t = useTranslate();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<State>(token ? 'pending' : 'missing-token');
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!token) return;

    let active = true;
    setState('pending');
    setErrorKind(null);

    authApi
      .verifyEmail(token)
      .then(async (res) => {
        if (!active) return;
        setState(res.alreadyVerified ? 'already-verified' : 'success');

        const accessToken = useAuthStore.getState().accessToken;
        if (accessToken) {
          try {
            const profile = await authApi.getProfile();
            if (active) useAuthStore.getState().setUser(profile);
          } catch {
            /* profile refresh is best-effort */
          }
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError) {
          if (err.status === 429) {
            setErrorKind('rate-limit');
          } else if (err.status >= 500 || err.status === 0) {
            setErrorKind('network');
          } else {
            setErrorKind('invalid');
          }
        } else {
          setErrorKind('network');
        }
        setState('failed');
      });

    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (state !== 'success' && state !== 'already-verified') return;
    const target = accessToken ? '/dashboard' : '/login';
    const timer = setTimeout(() => router.replace(target), REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [state, router, accessToken]);

  const handleContinue = () => {
    router.replace(accessToken ? '/dashboard' : '/login');
  };

  const handleResend = async () => {
    const email = resendEmail.trim();
    if (!email) {
      toast.error(t('auth.verify.resendNeedEmail'));
      return;
    }
    setResending(true);
    try {
      await authApi.resendVerification(email);
      toast.success(t('auth.unverified.resendSent'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast.error(t('auth.unverified.tooManyRequests'));
      } else {
        toast.error(t('auth.unverified.resendFailed'));
      }
    } finally {
      setResending(false);
    }
  };

  if (state === 'missing-token') {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <p className="text-sm text-gray-700">{t('auth.verify.missingToken')}</p>
        <Link href="/login" className="btn-gov-secondary inline-flex w-full justify-center">
          {t('auth.verify.goToLogin')}
        </Link>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        <p className="text-sm font-medium text-gray-900">{t('auth.verify.title')}</p>
        <p className="text-sm text-gray-600">{t('auth.verify.pending')}</p>
      </div>
    );
  }

  if (state === 'success' || state === 'already-verified') {
    const isAlready = state === 'already-verified';
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
          <CheckCircle2 className="h-6 w-6 text-success-700" />
        </div>
        <p className="text-sm font-medium text-gray-900">
          {isAlready ? t('auth.verify.alreadyVerified') : t('auth.verify.success')}
        </p>
        <p className="text-xs text-gray-500">{t('auth.verify.redirecting')}</p>
        <button
          type="button"
          onClick={handleContinue}
          className="btn-gov-primary flex w-full items-center justify-center gap-1.5"
        >
          {accessToken ? t('auth.verify.continue') : t('auth.verify.goToLogin')}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const failureMessage =
    errorKind === 'network'
      ? t('auth.verify.networkError')
      : errorKind === 'rate-limit'
        ? t('auth.unverified.tooManyRequests')
        : t('auth.verify.invalidToken');

  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-red-600" />
      </div>
      <p className="text-sm text-gray-700">{failureMessage}</p>

      <div className="space-y-2 text-left">
        <label htmlFor="verify-resend-email" className="block text-xs font-medium text-gray-700">
          {t('auth.verify.resendLabel')}
        </label>
        <input
          id="verify-resend-email"
          type="email"
          autoComplete="email"
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
          placeholder={t('auth.verify.resendPlaceholder')}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="btn-gov-secondary w-full justify-center"
        >
          {resending ? t('auth.unverified.resending') : t('auth.verify.resend')}
        </button>
      </div>

      <Link href="/login" className="btn-gov-primary inline-flex w-full justify-center">
        {t('auth.verify.goToLogin')}
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
            <Suspense
              fallback={
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <p className="text-sm text-gray-600">{t('auth.verify.pending')}</p>
                </div>
              }
            >
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
