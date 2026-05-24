'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authApi, municipalitiesApi, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useTranslate, useLocale } from '@/lib/i18n';
import { useCooldown } from '@/lib/hooks/use-cooldown';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import {
  UserPlus,
  Eye,
  EyeOff,
  Loader2,
  ChevronDown,
  MailCheck,
  ArrowRight,
} from 'lucide-react';
import type { Municipality } from '@shared/types/municipality';

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslate();
  const locale = useLocale();
  const { setAuth, user } = useAuthStore();

  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [loadingMunis, setLoadingMunis] = useState(true);
  const [muniError, setMuniError] = useState('');
  const [selectedMuniCode, setSelectedMuniCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  /**
   * After a successful registration we keep the user on this page and show
   * the "check your inbox" screen. They were already signed in by the
   * register call, but we deliberately defer the redirect to /dashboard so
   * they don't miss the email-verification instructions.
   */
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  // 60s cooldown matches the per-route backend throttle on /auth/resend-verification.
  const resendCooldown = useCooldown(60);

  // Don't auto-redirect signed-in users *while* showing the verification
  // screen — they just registered and we want them to see it.
  useEffect(() => {
    if (user && !registeredEmail) router.replace('/dashboard');
  }, [user, router, registeredEmail]);

  const fetchMunicipalities = () => {
    setLoadingMunis(true);
    setMuniError('');
    municipalitiesApi
      .list()
      .then((data) => {
        // The API client unwraps {success, data:{data:[]}} into the inner array,
        // but tolerate either shape defensively in case the contract ever changes.
        const list: Municipality[] = (
          Array.isArray(data) ? data : ((data as any)?.data ?? [])
        ) as Municipality[];
        setMunicipalities(list);
        if (list.length === 1) setSelectedMuniCode(list[0].code);
        if (list.length === 0) setMuniError(t('common.noData'));
      })
      .catch(() => {
        setMuniError(t('common.error'));
        toast.error(t('common.error'));
      })
      .finally(() => setLoadingMunis(false));
  };

  useEffect(() => {
    fetchMunicipalities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMuniCode || !firstName || !lastName || !email || !password) {
      toast.error(t('auth.login.fillAll'));
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register({
        municipalityCode: selectedMuniCode,
        email,
        password,
        firstName,
        lastName,
        phone: phone || undefined,
      });
      // We sign the user in immediately so they can hit /dashboard from
      // the "Continue" button below without re-typing credentials, but
      // we render the verification CTA first so they understand they
      // still need to click the link in their inbox.
      setAuth(res.user, res.accessToken, res.refreshToken);
      setRegisteredEmail(res.user.email);
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

  const handleResend = async () => {
    if (!registeredEmail || resendCooldown.isCoolingDown) return;
    setResending(true);
    try {
      await authApi.resendVerification(registeredEmail);
      // Backend is enumeration-safe: always returns ok. Show the same
      // localized confirmation regardless of underlying outcome.
      toast.success(t('auth.register.resendSent'));
      // Start the 60s cooldown so the user can't spam the endpoint into
      // a 429 (and then complain about a "broken button").
      resendCooldown.start();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          // Honour the backend throttle on the client too.
          resendCooldown.start();
          toast.error(t('auth.unverified.tooManyRequests'));
        } else {
          // Never surface raw backend messages here — this is the post-
          // registration "happy path" UI and a scary error string would
          // confuse new users.
          toast.error(t('auth.unverified.resendFailed'));
        }
      } else {
        toast.error(t('auth.login.serverError'));
      }
    } finally {
      setResending(false);
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

      <div className="flex flex-1 items-start justify-center px-4 py-8">
        <div className="w-full max-w-sm">

          {/* Brand */}
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded bg-brand-700 shadow">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">{t('auth.register.title')}</h1>
            <p className="text-xs text-gray-500">{t('auth.register.subtitle')}</p>
          </div>

          {registeredEmail ? (
            <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded bg-success-50 p-2">
                  <MailCheck className="h-5 w-5 text-success-700" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">
                    {t('auth.register.success')}
                  </h2>
                </div>
              </div>
              <p className="mb-5 text-xs leading-relaxed text-gray-600">
                {t('auth.register.checkEmail', { email: registeredEmail })}
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending || resendCooldown.isCoolingDown}
                  className="btn-gov-secondary w-full justify-center"
                >
                  {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {resendCooldown.isCoolingDown
                    ? t('auth.unverified.resendIn', {
                        seconds: resendCooldown.remaining,
                      })
                    : resending
                      ? t('auth.register.resending')
                      : t('auth.register.resend')}
                </button>
                <button
                  type="button"
                  onClick={() => router.replace('/dashboard')}
                  className="btn-gov-primary w-full justify-center"
                >
                  {t('auth.register.continueToDashboard')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
          <div className="rounded border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">
              {t('auth.register.heading')}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* Municipality */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('common.municipality')} <span className="text-alert-600">*</span>
                </label>
                {muniError ? (
                  <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2">
                    <span className="text-xs text-red-600">{muniError}</span>
                    <button
                      type="button"
                      onClick={fetchMunicipalities}
                      className="ms-auto text-xs font-semibold text-brand-600 hover:underline"
                    >
                      {t('common.retry')}
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedMuniCode}
                      onChange={(e) => setSelectedMuniCode(e.target.value)}
                      className="select-gov w-full appearance-none pe-8"
                      disabled={loadingMunis}
                    >
                      <option value="">
                        {loadingMunis ? t('common.loading') : `— ${t('common.municipality')} —`}
                      </option>
                      {municipalities.map((m) => (
                        <option key={m.id} value={m.code}>
                          {m.name} ({m.code})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                )}
              </div>

              {/* Name row */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    {t('auth.register.firstName')} <span className="text-alert-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="input-gov"
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-700">
                    {t('auth.register.lastName')} <span className="text-alert-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="input-gov"
                    autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('auth.register.email')} <span className="text-alert-600">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-gov"
                  autoComplete="email"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('auth.register.phone')}{' '}
                  <span className="font-normal text-gray-400">({t('common.optional')})</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+961 XX XXX XXX"
                  className="input-gov"
                />
              </div>

              {/* Password */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  {t('auth.register.password')} <span className="text-alert-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-gov pe-10"
                    autoComplete="new-password"
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
                className="btn-gov-primary w-full justify-center mt-1"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {loading ? t('auth.register.submitting') : t('auth.register.submit')}
              </button>
            </form>
          </div>
          )}

          {!registeredEmail && (
          <p className="mt-4 text-center text-xs text-gray-500">
            {t('auth.register.hasAccount')}{' '}
            <Link href="/login" className="font-semibold text-brand-600 hover:underline">
              {t('auth.register.signIn')}
            </Link>
          </p>
          )}

          <p className="mt-3 text-center text-[10px] text-gray-400">
            {t('common.appName')} · {t('common.tagline')}
          </p>
        </div>
      </div>
    </div>
  );
}
