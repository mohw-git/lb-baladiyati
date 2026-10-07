'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authApi, ApiError, getFileUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/auth';
import { getFullName } from '@/lib/utils';
import { ImageUploadCropper } from '@/components/ui/image-upload-cropper';
import { Avatar } from '@/components/ui/avatar';
import {
  Loader2,
  Save,
  Camera,
  Lock,
  ShieldCheck,
  Shield,
  Eye,
  EyeOff,
  AlertTriangle,
  Mail,
} from 'lucide-react';
import { useTranslate, pickName, useLocale } from '@/lib/i18n';
import { isCitizenAccount } from '@/lib/auth/user';
import { CitizenKycCard } from '@/components/kyc/citizen-kyc-card';

export default function ProfilePage() {
  const t = useTranslate();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const authUser = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarCacheBust, setAvatarCacheBust] = useState<number>(0);

  // Profile editing state
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [editing, setEditing] = useState(false);

  // Password change state
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirm: '',
  });
  const [showPw, setShowPw] = useState(false);

  // 2FA state
  const [show2faSetup, setShow2faSetup] = useState(false);
  const [twoFaSetupData, setTwoFaSetupData] = useState<{
    qrCodeDataUrl: string;
    secret: string;
  } | null>(null);
  const [twoFaCode, setTwoFaCode] = useState('');
  const [show2faDisable, setShow2faDisable] = useState(false);
  const [disableForm, setDisableForm] = useState({ password: '', code: '' });
  const [disableEmailOtpSent, setDisableEmailOtpSent] = useState(false);
  // Email-2FA enrolment dialog state
  const [showEmail2faModal, setShowEmail2faModal] = useState(false);
  const [emailEnablePassword, setEmailEnablePassword] = useState('');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  // Mutations
  const updateMutation = useMutation({
    mutationFn: () =>
      authApi.updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      }),
    onSuccess: (updatedUser) => {
      toast.success(t('profile.toast.updated'));
      setUser(updatedUser);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => authApi.uploadAvatar(file),
    onSuccess: async (result) => {
      toast.success(t('upload.success'));
      const bust = Date.now();
      setAvatarCacheBust(bust);
      // Apply new URL immediately so profile UI updates before refetch finishes.
      queryClient.setQueryData(['profile'], (old: typeof profile) =>
        old ? { ...old, avatarUrl: result.avatarUrl } : old,
      );
      const sessionUser = useAuthStore.getState().user;
      if (sessionUser) {
        setUser({ ...sessionUser, avatarUrl: result.avatarUrl });
      }
      const fresh = await authApi.getProfile();
      setUser(fresh);
      queryClient.setQueryData(['profile'], fresh);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: ApiError) => toast.error(err.getDisplayMessage()),
  });

  const handleAvatarCropped = async (file: File) => {
    await avatarMutation.mutateAsync(file);
  };

  const handleAvatarRemove = async () => {
    // No backend endpoint to clear avatar; we set it to empty via update.
    // Backend ignores empty strings on update, so this is a soft no-op for now.
    toast.info(t('upload.removed'));
  };

  const passwordMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      }),
    onSuccess: () => {
      toast.success(t('profile.password.changed'));
      setShowPwModal(false);
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const setup2faMutation = useMutation({
    mutationFn: () => authApi.setupTwoFactor(),
    onSuccess: (data) => {
      setTwoFaSetupData({ qrCodeDataUrl: data.qrCodeDataUrl, secret: data.secret });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const verify2faMutation = useMutation({
    mutationFn: () => authApi.verifyTwoFactor(twoFaCode),
    onSuccess: async () => {
      toast.success(t('profile.2fa.setup.success'));
      setShow2faSetup(false);
      setTwoFaSetupData(null);
      setTwoFaCode('');
      const fresh = await authApi.getProfile();
      setUser(fresh);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const disable2faMutation = useMutation({
    mutationFn: () =>
      authApi.disableTwoFactor({ password: disableForm.password, code: disableForm.code }),
    onSuccess: async () => {
      toast.success(t('profile.2fa.disable.success'));
      setShow2faDisable(false);
      setDisableForm({ password: '', code: '' });
      setDisableEmailOtpSent(false);
      const fresh = await authApi.getProfile();
      setUser(fresh);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const requestDisableEmail2faMutation = useMutation({
    mutationFn: () => authApi.requestDisableEmailTwoFactor(disableForm.password),
    onSuccess: () => {
      setDisableEmailOtpSent(true);
      toast.success(t('profile.2fa.disable.codeSent'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const confirmDisableEmail2faMutation = useMutation({
    mutationFn: () =>
      authApi.confirmDisableEmailTwoFactor({
        password: disableForm.password,
        code: disableForm.code,
      }),
    onSuccess: async () => {
      toast.success(t('profile.2fa.disable.success'));
      setShow2faDisable(false);
      setDisableForm({ password: '', code: '' });
      setDisableEmailOtpSent(false);
      const fresh = await authApi.getProfile();
      setUser(fresh);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  // Enable EMAIL-based 2FA. Backend requires the user's password AND a
  // verified email; we keep the UI strict about both so users don't
  // accidentally lock themselves out by enrolling without a working inbox.
  const enableEmail2faMutation = useMutation({
    mutationFn: () => authApi.enableEmailTwoFactor(emailEnablePassword),
    onSuccess: async () => {
      toast.success(t('profile.2fa.email.success'));
      setShowEmail2faModal(false);
      setEmailEnablePassword('');
      const fresh = await authApi.getProfile();
      setUser(fresh);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!profile) {
    return <div className="py-20 text-center text-gray-500">{t('common.noData')}</div>;
  }

  const initials = `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase();
  const profileAvatarUrl =
    (profile as { avatarUrl?: string | null })?.avatarUrl ??
    authUser?.avatarUrl ??
    null;
  const twoFaEnabled = !!(profile as any).twoFactorEnabled;
  const twoFaMethod = ((profile as any).twoFactorMethod as 'TOTP' | 'EMAIL' | null) ?? null;
  const emailVerified = !!(profile as any).emailVerifiedAt;
  const mustEnroll2fa = !!(profile as any).mustEnrollTwoFactor;
  const isCitizenProfile = isCitizenAccount(profile as any);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">{t('profile.title')}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{t('profile.subtitle')}</p>
      </div>

      {mustEnroll2fa && !twoFaEnabled && !isCitizenProfile && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">{t('profile.2fa.mustEnrollTitle')}</p>
            <p className="mt-1">{t('profile.2fa.mustEnrollBody')}</p>
          </div>
        </div>
      )}

      <CitizenKycCard />

      {/* === USER INFO === */}
      <div className="gov-card overflow-hidden">
        <div className="gov-section-header flex items-center justify-between">
          <span>{t('profile.section.personal')}</span>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 normal-case tracking-normal"
            >
              {t('common.edit')}
            </button>
          )}
        </div>
        <div className="p-4">

        {/* Avatar with crop UX */}
        <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar
            src={profileAvatarUrl}
            firstName={profile.firstName}
            lastName={profile.lastName}
            size={88}
            cacheKey={avatarCacheBust || profileAvatarUrl || undefined}
          />
          <div className="flex-1">
            <p className="text-base font-semibold text-gray-900">{getFullName(profile)}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <div className="mt-3">
              <ImageUploadCropper
                value={profileAvatarUrl}
                onCropped={handleAvatarCropped}
                onRemove={profileAvatarUrl ? handleAvatarRemove : undefined}
                aspect={1}
                circular
                previewSize={56}
                previewCacheBust={avatarCacheBust || profileAvatarUrl || undefined}
                hint="JPG, PNG or WebP — max 5 MB"
              />
            </div>
          </div>
        </div>

        {editing ? (
          <form
            onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">{t('profile.form.firstName')} *</label>
                <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required className="input-gov" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-gray-700">{t('profile.form.lastName')} *</label>
                <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required className="input-gov" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-700">{t('profile.form.phone')}</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-gov" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => { setEditing(false); setForm({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone || '' }); }} className="btn-gov-secondary">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={updateMutation.isPending} className="btn-gov-primary">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">{t('profile.form.phone')}</dt>
              <dd className="text-sm font-medium text-gray-900">{profile.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">{t('common.municipality')}</dt>
              <dd className="text-sm font-medium text-gray-900">
                {profile.municipality
                  ? pickName(profile.municipality as any, locale) || profile.municipality.name
                  : '—'}
              </dd>
            </div>
            {isCitizenProfile ? (
              <div>
                <dt className="text-xs text-gray-500">{t('profile.emailVerification.label')}</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {emailVerified
                    ? t('profile.emailVerification.verified')
                    : t('profile.emailVerification.pending')}
                </dd>
              </div>
            ) : (
              <>
                <div>
                  <dt className="text-xs text-gray-500">{t('common.role')}</dt>
                  <dd className="flex flex-wrap gap-1">
                    {profile.roles?.length
                      ? profile.roles.map((r: any) => {
                          const name = typeof r === 'string' ? r : r.name;
                          const key = typeof r === 'string' ? r : r.id;
                          return (
                            <span
                              key={key}
                              className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
                            >
                              {name}
                            </span>
                          );
                        })
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">{t('common.department')}</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {profile.department
                      ? pickName(profile.department as any, locale) || profile.department.name
                      : '—'}
                  </dd>
                </div>
              </>
            )}
          </dl>
        )}
        </div>
      </div>

      {/* === SECURITY === */}
      <div className="gov-card overflow-hidden">
        <div className="gov-section-header">{t('profile.section.security')}</div>
        <div className="divide-y divide-gray-100 p-0">
          {/* Password */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-100">
                <Lock className="h-4 w-4 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{t('profile.password.change')}</p>
                <p className="text-xs text-gray-500">{t('auth.login.password')}</p>
              </div>
            </div>
            <button onClick={() => setShowPwModal(true)} className="btn-gov-secondary text-xs">
              {t('common.edit')}
            </button>
          </div>

          {/* 2FA */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded ${twoFaEnabled ? 'bg-success-50' : 'bg-gray-100'}`}>
                <ShieldCheck className={`h-4 w-4 ${twoFaEnabled ? 'text-success-700' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  {t('profile.2fa.title')}
                  {twoFaEnabled && (
                    <span className="rounded bg-success-100 px-1.5 py-0.5 text-[10px] font-bold text-success-800">
                      {t('common.enabled')}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {twoFaEnabled
                    ? twoFaMethod === 'EMAIL'
                      ? t('profile.2fa.enabledEmail')
                      : t('profile.2fa.enabledTotp')
                    : t('profile.2fa.disabled')}
                </p>
              </div>
            </div>
            {twoFaEnabled ? (
              <div className="flex gap-2">
                {twoFaMethod === 'EMAIL' && (
                  <button
                    onClick={() => { setShow2faSetup(true); setup2faMutation.mutate(); }}
                    className="btn-gov-secondary text-xs"
                  >
                    {t('profile.2fa.switchTotp')}
                  </button>
                )}
                <button
                  onClick={() => {
                    setDisableEmailOtpSent(false);
                    setDisableForm({ password: '', code: '' });
                    setShow2faDisable(true);
                  }}
                  className="btn-gov-danger text-xs"
                >
                  {t('profile.2fa.disable')}
                </button>
              </div>
            ) : (
              <button onClick={() => { setShow2faSetup(true); setup2faMutation.mutate(); }} className="btn-gov-primary text-xs">
                {t('profile.2fa.enable')}
              </button>
            )}
          </div>

          {/* Email-based 2FA */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded ${twoFaEnabled && twoFaMethod === 'EMAIL' ? 'bg-success-50' : 'bg-gray-100'}`}>
                <Mail className={`h-4 w-4 ${twoFaEnabled && twoFaMethod === 'EMAIL' ? 'text-success-700' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  {t('profile.2fa.email.enable')}
                  {twoFaEnabled && twoFaMethod === 'EMAIL' && (
                    <span className="rounded bg-success-100 px-1.5 py-0.5 text-[10px] font-bold text-success-800">
                      {t('common.enabled')}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {twoFaEnabled && twoFaMethod === 'EMAIL'
                    ? t('profile.2fa.email.enabled')
                    : !emailVerified
                      ? t('profile.2fa.email.notVerified')
                      : t('profile.2fa.email.enableDesc')}
                </p>
              </div>
            </div>
            {!(twoFaEnabled && twoFaMethod === 'EMAIL') && (
              <button
                onClick={() => setShowEmail2faModal(true)}
                disabled={!emailVerified}
                className="btn-gov-secondary text-xs disabled:opacity-50"
                title={!emailVerified ? t('profile.2fa.email.notVerified') : undefined}
              >
                {twoFaEnabled ? t('common.edit') : t('profile.2fa.enable')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* === Password modal === */}
      {showPwModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !passwordMutation.isPending && setShowPwModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-bold text-gray-900">Change Password</h3>
            <p className="mb-4 text-sm text-gray-500">
              You will be signed out of all other devices.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (pwForm.newPassword !== pwForm.confirm) {
                  toast.error('Passwords do not match');
                  return;
                }
                if (pwForm.newPassword.length < 8) {
                  toast.error('New password must be at least 8 characters');
                  return;
                }
                passwordMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.currentPassword}
                    onChange={(e) =>
                      setPwForm({ ...pwForm, currentPassword: e.target.value })
                    }
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPwModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {passwordMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Change Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === 2FA Setup Modal === */}
      {show2faSetup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !verify2faMutation.isPending && setShow2faSetup(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2">
                <Shield className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{t('profile.2fa.setup.title')}</h3>
                <p className="text-sm text-gray-500">{t('profile.2fa.setup.subtitle')}</p>
              </div>
            </div>

            {setup2faMutation.isPending || !twoFaSetupData ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                  <Image
                    src={twoFaSetupData.qrCodeDataUrl}
                    alt="QR Code"
                    width={220}
                    height={220}
                    unoptimized
                    className="mx-auto"
                  />
                </div>
                <details className="mb-4 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                  <summary className="cursor-pointer text-gray-700">
                    {t('profile.2fa.setup.manualKey')}
                  </summary>
                  <code className="mt-2 block break-all rounded bg-gray-50 p-2 text-xs">
                    {twoFaSetupData.secret}
                  </code>
                </details>

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('profile.2fa.setup.enterCode')}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl font-mono tracking-widest focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setShow2faSetup(false)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    onClick={() => verify2faMutation.mutate()}
                    disabled={twoFaCode.length !== 6 || verify2faMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {verify2faMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('profile.2fa.setup.verify')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* === 2FA Disable Modal === */}
      {show2faDisable && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() =>
            !disable2faMutation.isPending &&
            !confirmDisableEmail2faMutation.isPending &&
            !requestDisableEmail2faMutation.isPending &&
            setShow2faDisable(false)
          }
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-red-50 p-2">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{t('profile.2fa.disable.title')}</h3>
                <p className="text-sm text-gray-500">{t('profile.2fa.disable.subtitle')}</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (twoFaMethod === 'EMAIL') {
                  if (!disableEmailOtpSent) {
                    requestDisableEmail2faMutation.mutate();
                  } else {
                    confirmDisableEmail2faMutation.mutate();
                  }
                } else {
                  disable2faMutation.mutate();
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('profile.2fa.disable.password')}
                </label>
                <input
                  type="password"
                  required
                  value={disableForm.password}
                  onChange={(e) => setDisableForm({ ...disableForm, password: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  autoComplete="current-password"
                />
              </div>
              {(twoFaMethod !== 'EMAIL' || disableEmailOtpSent) && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {twoFaMethod === 'EMAIL'
                      ? t('profile.2fa.disable.emailCode')
                      : t('profile.2fa.disable.totpCode')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    required={twoFaMethod !== 'EMAIL' || disableEmailOtpSent}
                    value={disableForm.code}
                    onChange={(e) =>
                      setDisableForm({
                        ...disableForm,
                        code: e.target.value.replace(/\D/g, '').slice(0, 6),
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center font-mono text-2xl tracking-widest focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShow2faDisable(false);
                    setDisableEmailOtpSent(false);
                    setDisableForm({ password: '', code: '' });
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={
                    disable2faMutation.isPending ||
                    confirmDisableEmail2faMutation.isPending ||
                    requestDisableEmail2faMutation.isPending ||
                    (twoFaMethod === 'EMAIL' &&
                      disableEmailOtpSent &&
                      disableForm.code.length !== 6)
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {(disable2faMutation.isPending ||
                    confirmDisableEmail2faMutation.isPending ||
                    requestDisableEmail2faMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {twoFaMethod === 'EMAIL' && !disableEmailOtpSent
                    ? t('profile.2fa.disable.requestCode')
                    : t('profile.2fa.disable.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* === Email 2FA enable Modal === */}
      {showEmail2faModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !enableEmail2faMutation.isPending && setShowEmail2faModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-lg bg-emerald-50 p-2">
                <Mail className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {t('profile.2fa.email.enable')}
                </h3>
                <p className="text-sm text-gray-500">{t('profile.2fa.email.enableDesc')}</p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!emailEnablePassword) return;
                enableEmail2faMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('profile.2fa.email.confirmPassword')}
                </label>
                <input
                  type="password"
                  required
                  value={emailEnablePassword}
                  onChange={(e) => setEmailEnablePassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  autoComplete="current-password"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEmail2faModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!emailEnablePassword || enableEmail2faMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {enableEmail2faMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('profile.2fa.enable')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

