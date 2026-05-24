'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { authApi, ApiError } from '@/lib/api';
import { useTranslate } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { KeyRound, Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

/**
 * Forgot-password page.
 *
 * The backend always returns the same generic "if an account exists…" message
 * regardless of whether the email is registered (enumeration-safe). We render
 * a success state after submission so the user knows what to expect next.
 */
export default function ForgotPasswordPage() {
  const t = useTranslate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error(t('auth.login.fillAll'));
      return;
    }
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      // Backend always returns 200 on this endpoint. Anything that throws
      // here is a network / server error, not a "not found" leak.
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(t('auth.login.serverError'));
      }
    } finally {
      setLoading(false);
    }
  };

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
            <h1 className="text-lg font-bold text-gray-900">{t('auth.forgot.title')}</h1>
            <p className="text-xs text-gray-500">{t('auth.forgot.subtitle')}</p>
          </div>

          <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
            {sent ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
                  <CheckCircle2 className="h-6 w-6 text-success-700" />
                </div>
                <p className="text-sm text-gray-700">{t('auth.forgot.sent')}</p>
                <Link
                  href="/login"
                  className="btn-gov-secondary inline-flex w-full justify-center"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t('auth.forgot.backToLogin')}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    {t('auth.forgot.email')} <span className="text-alert-600">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-gov ps-9"
                      autoComplete="email"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-gov-primary w-full justify-center"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  {loading ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
                </button>
                <Link
                  href="/login"
                  className="block text-center text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  {t('auth.forgot.backToLogin')}
                </Link>
              </form>
            )}
          </div>

          <p className="mt-4 text-center text-[10px] text-gray-400">
            {t('common.appName')} · {t('common.tagline')}
          </p>
        </div>
      </div>
    </div>
  );
}
