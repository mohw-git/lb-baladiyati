'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { authApi, ApiError } from '@/lib/api';
import { useTranslate } from '@/lib/i18n';
import { PublicAuthLayout } from '@/components/auth/public-auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
import {
  KeyRound,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';

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

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-600" />
        </div>
        <p className="text-sm text-gray-700">{t('auth.reset.missingToken')}</p>
        <Link href="/forgot-password" className="btn-gov-secondary inline-flex w-full justify-center py-2.5">
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
        <Link href="/login" className="btn-gov-primary inline-flex w-full justify-center py-2.5">
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
      <button type="submit" disabled={loading} className="btn-gov-primary w-full justify-center py-2.5">
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
    <PublicAuthLayout variant="reset">
      <AuthCard
        icon={<KeyRound className="h-6 w-6 text-navy-900" />}
        title={t('auth.reset.title')}
        subtitle={t('auth.reset.subtitle')}
      >
        <Suspense fallback={<Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />}>
          <ResetPasswordContent />
        </Suspense>
      </AuthCard>
    </PublicAuthLayout>
  );
}
