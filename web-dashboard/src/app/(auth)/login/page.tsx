'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authApi, ApiError } from '@/lib/api';
import type { TwoFactorMethod } from '@/lib/api/endpoints/auth';
import { useAuthStore } from '@/lib/auth';
import { useTranslate } from '@/lib/i18n';
import { PublicAuthLayout } from '@/components/auth/public-auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
import { UnverifiedEmailBanner } from '@/components/auth/unverified-email-banner';
import {
  Eye,
  EyeOff,
  Loader2,
  LogIn,
  ShieldCheck,
  Mail,
  RefreshCw,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslate();
  const { setAuth, user } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [twoFa, setTwoFa] = useState<{
    challengeToken: string;
    code: string;
    method: TwoFactorMethod;
  } | null>(null);
  const [resendingCode, setResendingCode] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error(t('auth.login.fillAll'));
      return;
    }
    setLoading(true);
    try {
      const res: any = await authApi.login({ email, password });
      setUnverifiedEmail(null);
      if (res?.twoFactorRequired) {
        const method: TwoFactorMethod = res.twoFactorMethod === 'EMAIL' ? 'EMAIL' : 'TOTP';
        setTwoFa({ challengeToken: res.challengeToken, code: '', method });
        toast.message(
          method === 'EMAIL' ? t('auth.2fa.emailSubtitle') : t('auth.2fa.subtitle'),
        );
      } else {
        setAuth(res.user, res.accessToken, res.refreshToken);
        toast.success(t('auth.login.welcome', { name: res.user.firstName }));
        router.replace('/dashboard');
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          const echoed = (err.meta?.email as string | undefined) ?? email;
          setUnverifiedEmail(echoed);
          toast.error(t('auth.unverified.loginWarning'));
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error(t('auth.login.serverError'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFa || twoFa.code.length !== 6) return;
    setLoading(true);
    try {
      const res =
        twoFa.method === 'EMAIL'
          ? await authApi.emailTwoFactorLogin({
              challengeToken: twoFa.challengeToken,
              code: twoFa.code,
            })
          : await authApi.twoFactorLogin({
              challengeToken: twoFa.challengeToken,
              code: twoFa.code,
            });
      setAuth(res.user, res.accessToken, res.refreshToken);
      toast.success(t('auth.login.welcome', { name: res.user.firstName }));
      router.replace('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(t('auth.login.failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!twoFa || twoFa.method !== 'EMAIL') return;
    setResendingCode(true);
    try {
      await authApi.resendEmailTwoFactorCode(twoFa.challengeToken);
      toast.success(t('auth.2fa.codeResent'));
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error(t('auth.login.serverError'));
      }
    } finally {
      setResendingCode(false);
    }
  };

  return (
    <PublicAuthLayout
      variant="login"
      belowCard={
        !twoFa ? (
          <p className="text-xs text-white/90">
            {t('auth.login.noAccount')}{' '}
            <Link href="/register" className="font-semibold text-white underline-offset-2 hover:underline">
              {t('auth.login.register')}
            </Link>
          </p>
        ) : null
      }
    >
      {twoFa ? (
        <AuthCard
          icon={
            twoFa.method === 'EMAIL' ? (
              <Mail className="h-6 w-6 text-emerald-700" />
            ) : (
              <ShieldCheck className="h-6 w-6 text-emerald-700" />
            )
          }
          title={t('auth.2fa.title')}
          subtitle={
            twoFa.method === 'EMAIL' ? t('auth.2fa.emailSubtitle') : t('auth.2fa.subtitle')
          }
        >
          <form onSubmit={handleTwoFaSubmit} className="space-y-4">
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={twoFa.code}
              onChange={(e) =>
                setTwoFa({ ...twoFa, code: e.target.value.replace(/\D/g, '').slice(0, 6) })
              }
              placeholder="123456"
              className="input-gov text-center font-mono text-2xl tracking-widest"
            />
            <button
              type="submit"
              disabled={loading || twoFa.code.length !== 6}
              className="btn-gov-primary w-full justify-center py-2.5"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('auth.2fa.verify')}
            </button>
            {twoFa.method === 'EMAIL' && (
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendingCode}
                className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-800 disabled:opacity-50"
              >
                {resendingCode ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
                {resendingCode ? t('auth.2fa.resendingCode') : t('auth.2fa.resendCode')}
              </button>
            )}
            <button
              type="button"
              onClick={() => setTwoFa(null)}
              className="w-full text-xs text-gray-500 hover:text-gray-700"
            >
              {t('auth.2fa.back')}
            </button>
          </form>
        </AuthCard>
      ) : (
        <AuthCard
          icon={<LogIn className="h-6 w-6 text-navy-900" />}
          title={t('auth.login.title')}
          subtitle={t('auth.login.subtitle')}
        >
          <div className="space-y-4">
            {unverifiedEmail && (
              <UnverifiedEmailBanner
                email={unverifiedEmail}
                onChangeEmail={() => {
                  setUnverifiedEmail(null);
                  setEmail('');
                  setPassword('');
                }}
              />
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('auth.login.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@beirut.gov.lb"
                  className="input-gov"
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700">
                    {t('auth.login.password')}
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] font-semibold text-brand-600 hover:text-brand-800 hover:underline"
                  >
                    {t('auth.forgot.link')}
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-gov pe-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
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
                  <LogIn className="h-4 w-4" />
                )}
                {loading ? t('auth.login.submitting') : t('auth.login.submit')}
              </button>
            </form>
          </div>
        </AuthCard>
      )}
    </PublicAuthLayout>
  );
}
