'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { authApi, ApiError } from '@/lib/api';
import { useTranslate } from '@/lib/i18n';
import { PublicAuthLayout } from '@/components/auth/public-auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { KeyRound, Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';

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
    <PublicAuthLayout variant="forgot">
      <AuthCard
        icon={<KeyRound className="h-6 w-6 text-navy-900" />}
        title={t('auth.forgot.title')}
        subtitle={t('auth.forgot.subtitle')}
      >
        {sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50">
              <CheckCircle2 className="h-6 w-6 text-success-700" />
            </div>
            <p className="text-sm text-gray-700">{t('auth.forgot.sent')}</p>
            <Link href="/login" className="btn-gov-secondary inline-flex w-full justify-center py-2.5">
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
              className="btn-gov-primary w-full justify-center py-2.5"
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
      </AuthCard>
    </PublicAuthLayout>
  );
}
