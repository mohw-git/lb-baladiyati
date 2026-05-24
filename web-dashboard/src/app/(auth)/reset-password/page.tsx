'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { authApi, ApiError } from '@/lib/api';
import { useTranslate } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import {
  KeyRound,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';

/**
 * Complete a password reset using the token in the email link
 * (`/reset-password?token=<raw>`). The token is single-use server-side and
 * expires after 30 minutes. On success the user is invited back to /login
 * and all of their refresh tokens are revoked by the backend.
 */
function ResetPasswordContent() {
  const t = useTranslate();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error(t('auth.reset.missingToken'));
      return;
    }
    if (pw.length < 8) {
      toast.error(t('auth.reset.passwordTooShort'));
      return;
    }
    if (pw !== confirm) {
      toast.error(t('auth.reset.passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword: pw });
      setDone(true);
      // Move to login after a short pause so the user can read the confirmation.
      setTimeout(() => router.replace('/login'), 2500);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(t('auth.reset.invalidToken'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Show a clean error state when the link is missing the token query param.
  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <p className="text-sm text-gray-700">{t('auth.reset.missingToken')}</p>
        <Link
          href="/forgot-password"
          className="btn-gov-secondary inline-flex w-full justify-center"
        >
          {t('auth.forgot.title')}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
          <CheckCircle2 className="h-6 w-6 text-success-700" />
        </div>
        <p className="text-sm text-gray-700">{t('auth.reset.success')}</p>
        <Link href="/login" className="btn-gov-primary inline-flex w-full justify-center">
          <ArrowLeft className="h-4 w-4" />
          {t('auth.forgot.backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          {t('auth.reset.newPassword')} <span className="text-alert-600">*</span>
        </label>
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            minLength={8}
            required
            className="input-gov pe-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((v) => !v)}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-gray-700">
          {t('auth.reset.confirmPassword')} <span className="text-alert-600">*</span>
        </label>
        <input
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
          className="input-gov"
          autoComplete="new-password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="btn-gov-primary w-full justify-center"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        {loading ? t('auth.reset.submitting') : t('auth.reset.submit')}
      </button>
      <Link
        href="/login"
        className="block text-center text-xs font-medium text-gray-500 hover:text-gray-700"
      >
        {t('auth.forgot.backToLogin')}
      </Link>
    </form>
  );
}

export default function ResetPasswordPage() {
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
              <KeyRound className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">{t('auth.reset.title')}</h1>
            <p className="text-xs text-gray-500">{t('auth.reset.subtitle')}</p>
          </div>

          <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
            {/* useSearchParams must be in a Suspense boundary in Next.js app router */}
            <Suspense fallback={<Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />}>
              <ResetPasswordContent />
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
