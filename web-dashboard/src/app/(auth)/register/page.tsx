'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authApi, municipalitiesApi, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { useTranslate } from '@/lib/i18n';
import { useCooldown } from '@/lib/hooks/use-cooldown';
import { PublicAuthLayout } from '@/components/auth/public-auth-layout';
import { AuthCard } from '@/components/auth/auth-card';
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
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const resendCooldown = useCooldown(60);

  useEffect(() => {
    if (user && !registeredEmail) router.replace('/dashboard');
  }, [user, router, registeredEmail]);

  const fetchMunicipalities = () => {
    setLoadingMunis(true);
    setMuniError('');
    municipalitiesApi
      .list()
      .then((data) => {
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
      toast.error(t('auth.register.passwordTooShort'));
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
      toast.success(t('auth.register.resendSent'));
      resendCooldown.start();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          resendCooldown.start();
          toast.error(t('auth.unverified.tooManyRequests'));
        } else {
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
    <PublicAuthLayout
      variant="register"
      wideCard
      belowCard={
        !registeredEmail ? (
          <p className="text-xs text-white/90">
            {t('auth.register.hasAccount')}{' '}
            <Link href="/login" className="font-semibold text-white underline-offset-2 hover:underline">
              {t('auth.register.signIn')}
            </Link>
          </p>
        ) : null
      }
    >
      {registeredEmail ? (
        <AuthCard
          icon={<MailCheck className="h-6 w-6 text-emerald-700" />}
          title={t('auth.register.success')}
          subtitle={t('auth.register.checkEmail', { email: registeredEmail })}
        >
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending || resendCooldown.isCoolingDown}
              className="btn-gov-secondary w-full justify-center py-2.5"
            >
              {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {resendCooldown.isCoolingDown
                ? t('auth.unverified.resendIn', { seconds: resendCooldown.remaining })
                : resending
                  ? t('auth.register.resending')
                  : t('auth.register.resend')}
            </button>
            <button
              type="button"
              onClick={() => router.replace('/dashboard')}
              className="btn-gov-primary w-full justify-center py-2.5"
            >
              {t('auth.register.continueToDashboard')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </AuthCard>
      ) : (
        <AuthCard
          icon={<UserPlus className="h-6 w-6 text-navy-900" />}
          title={t('auth.register.title')}
          subtitle={t('auth.register.subtitle')}
        >
          <form onSubmit={handleSubmit} className="space-y-3.5">
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

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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

            <p className="text-[11px] leading-relaxed text-gray-500">{t('auth.shell.dataSecure')}</p>

            <button
              type="submit"
              disabled={loading}
              className="btn-gov-primary mt-1 w-full justify-center py-2.5"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              {loading ? t('auth.register.submitting') : t('auth.register.submit')}
            </button>
          </form>
        </AuthCard>
      )}
    </PublicAuthLayout>
  );
}
