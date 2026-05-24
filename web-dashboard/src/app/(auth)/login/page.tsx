'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authApi, ApiError } from '@/lib/api';
import type { TwoFactorMethod } from '@/lib/api/endpoints/auth';
import { useAuthStore } from '@/lib/auth';
import { useTranslate, useLocale } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { UnverifiedEmailBanner } from '@/components/auth/unverified-email-banner';
import {
  Building2,
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
  const locale = useLocale();
  const { setAuth, user } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * In-flight 2FA challenge state. When `method` is 'EMAIL' the OTP has
   * already been emailed by the backend; we just need to collect the code
   * and POST it to /auth/2fa/email/login. When `method` is 'TOTP' (the
   * default for legacy accounts) we POST to /auth/2fa/login.
   */
  const [twoFa, setTwoFa] = useState<{
    challengeToken: string;
    code: string;
    method: TwoFactorMethod;
  } | null>(null);
  const [resendingCode, setResendingCode] = useState(false);
  /**
   * When the backend returns 403 EMAIL_NOT_VERIFIED we stash the email
   * the server confirmed (always identical to what we sent) and surface
   * the dedicated banner with a Resend button. The state lives until the
   * user either succeeds at login, clicks "wrong email", or refreshes.
   */
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
      // A successful login always clears any prior unverified state.
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
        // Structured "email not verified" 403 — render the banner instead
        // of a toast. The backend echoes back the canonical email so we
        // don't have to trust the form value.
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          const echoed = (err.meta?.email as string | undefined) ?? email;
          setUnverifiedEmail(echoed);
          // A localized toast still appears so the change of state is
          // noticed even when the banner is below the fold on mobile.
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
      // Pick the correct backend endpoint based on the user's enrolled
      // 2FA method. The shape of the response is identical (LoginResponse).
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
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* Government top bar */}
      <div className="border-b border-gray-200 bg-navy-900 px-4 py-2">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <span className="text-xs text-navy-300">
            {t('landing.topbar.email')}
          </span>
          <LanguageSwitcher />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">

          {/* Brand */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded bg-brand-700 shadow">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">{t('auth.login.title')}</h1>
            <p className="text-xs text-gray-500">{t('auth.login.subtitle')}</p>
          </div>

          {/* 2FA Challenge */}
          {twoFa && (
            <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded bg-success-50 p-2">
                  {twoFa.method === 'EMAIL' ? (
                    <Mail className="h-5 w-5 text-success-700" />
                  ) : (
                    <ShieldCheck className="h-5 w-5 text-success-700" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {t('auth.2fa.title')}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {twoFa.method === 'EMAIL'
                      ? t('auth.2fa.emailSubtitle')
                      : t('auth.2fa.subtitle')}
                  </p>
                </div>
              </div>
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
                  className="btn-gov-primary w-full justify-center"
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
            </div>
          )}

          {/* Login Form */}
          {!twoFa && (
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
              <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-sm font-semibold text-gray-900">
                {t('auth.login.heading')}
              </h2>

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
                  className="btn-gov-primary w-full justify-center"
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
            </div>
          )}

          <p className="mt-5 text-center text-xs text-gray-500">
            {t('auth.login.noAccount')}{' '}
            <Link href="/register" className="font-semibold text-brand-600 hover:underline">
              {t('auth.login.register')}
            </Link>
          </p>

          <p className="mt-3 text-center text-[10px] text-gray-400">
            {t('common.appName')} · {t('common.tagline')}
          </p>
        </div>
      </div>
    </div>
  );
}
