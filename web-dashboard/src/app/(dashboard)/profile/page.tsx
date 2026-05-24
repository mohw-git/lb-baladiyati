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
import { useTranslate } from '@/lib/i18n';

export default function ProfilePage() {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    onSuccess: async () => {
      toast.success(t('upload.success'));
      // Re-fetch the FULL profile (includes isSuperAdmin etc.) so the auth
      // store is fresh and the navbar/sidebar avatar updates immediately.
      const fresh = await authApi.getProfile();
      setUser(fresh);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
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
      toast.success('Two-factor authentication enabled');
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
      toast.success('Two-factor authentication disabled');
      setShow2faDisable(false);
      setDisableForm({ password: '', code: '' });
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
  const avatarUrl = (profile as any).avatarUrl ? getFileUrl((profile as any).avatarUrl) : null;
  const twoFaEnabled = !!(profile as any).twoFactorEnabled;
  const twoFaMethod = ((profile as any).twoFactorMethod as 'TOTP' | 'EMAIL' | null) ?? null;
  const emailVerified = !!(profile as any).verifiedAt || !!(profile as any).emailVerifiedAt;
  const mustEnroll2fa = !!(profile as any).mustEnrollTwoFactor;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">{t('profile.title')}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{t('profile.subtitle')}</p>
      </div>

      {mustEnroll2fa && !twoFaEnabled && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              Two-factor authentication is required for all staff accounts.
            </p>
            <p className="mt-1">
              The Super Admin has enforced platform-wide 2FA. You must enrol in
              2FA below before you can use any other part of the application.
              Until then you&apos;ll keep being redirected back to this page.
            </p>
          </div>
        </div>
      )}

      {/* === IDENTITY VERIFICATION (citizens only) === */}
      <IdentityVerificationCard profile={profile} />

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
            src={(profile as any).avatarUrl}
            firstName={profile.firstName}
            lastName={profile.lastName}
            size={88}
            cacheKey={(profile as any).avatarUrl}
          />
          <div className="flex-1">
            <p className="text-base font-semibold text-gray-900">{getFullName(profile)}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <div className="mt-3">
              <ImageUploadCropper
                value={(profile as any).avatarUrl}
                onCropped={handleAvatarCropped}
                onRemove={(profile as any).avatarUrl ? handleAvatarRemove : undefined}
                aspect={1}
                circular
                previewSize={56}
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
            <div><dt className="text-xs text-gray-500">{t('profile.form.phone')}</dt><dd className="text-sm font-medium text-gray-900">{profile.phone || '—'}</dd></div>
            <div>
              <dt className="text-xs text-gray-500">{t('common.role')}</dt>
              <dd className="flex flex-wrap gap-1">
                {profile.roles?.length ? profile.roles.map((r: any) => { const name = typeof r === 'string' ? r : r.name; const key = typeof r === 'string' ? r : r.id; return <span key={key} className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{name}</span>; }) : '—'}
              </dd>
            </div>
            <div><dt className="text-xs text-gray-500">{t('common.municipality')}</dt><dd className="text-sm font-medium text-gray-900">{profile.municipality?.name || '—'}</dd></div>
            <div><dt className="text-xs text-gray-500">{t('common.department')}</dt><dd className="text-sm font-medium text-gray-900">{profile.department?.name || '—'}</dd></div>
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
                  {twoFaEnabled ? t('profile.2fa.enabled') : t('profile.2fa.disabled')}
                </p>
              </div>
            </div>
            {twoFaEnabled ? (
              <button onClick={() => setShow2faDisable(true)} className="btn-gov-danger text-xs">
                {t('profile.2fa.disable')}
              </button>
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
                <h3 className="text-lg font-bold text-gray-900">Enable 2FA</h3>
                <p className="text-sm text-gray-500">Scan with Google Authenticator or similar</p>
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
                    Can&apos;t scan? Enter this key manually
                  </summary>
                  <code className="mt-2 block break-all rounded bg-gray-50 p-2 text-xs">
                    {twoFaSetupData.secret}
                  </code>
                </details>

                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Enter the 6-digit code from your app
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
                    Cancel
                  </button>
                  <button
                    onClick={() => verify2faMutation.mutate()}
                    disabled={twoFaCode.length !== 6 || verify2faMutation.isPending}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {verify2faMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Verify & Enable
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
          onClick={() => !disable2faMutation.isPending && setShow2faDisable(false)}
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
                <h3 className="text-lg font-bold text-gray-900">Disable 2FA</h3>
                <p className="text-sm text-gray-500">
                  This will reduce your account security
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                disable2faMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={disableForm.password}
                  onChange={(e) => setDisableForm({ ...disableForm, password: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Current 6-digit Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
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
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShow2faDisable(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disable2faMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {disable2faMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Disable 2FA
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

// ============================================================
// Identity Verification (KYC) — for self-registered citizens
// ============================================================
function IdentityVerificationCard({ profile }: { profile: any }) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<{ idFront?: File; idBack?: File; selfie?: File }>({});

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!files.idFront || !files.idBack || !files.selfie) {
        throw new Error('Please upload all three documents');
      }
      // dynamic import keeps bundle clean
      return import('@/lib/api/endpoints/kyc').then(({ kycApi }) =>
        kycApi.submit({
          idFront: files.idFront!,
          idBack: files.idBack!,
          selfie: files.selfie!,
        }),
      );
    },
    onSuccess: () => {
      toast.success("Documents submitted. You'll be notified once reviewed.");
      setFiles({});
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to submit'),
  });

  // Show only for citizens (self-registered). Staff is auto-verified.
  if (profile?.createdVia !== 'SELF_REGISTRATION') return null;

  const status: string = profile.verificationStatus || 'UNVERIFIED';

  const STATUS: Record<string, { label: string; cls: string; sub: string }> = {
    VERIFIED: {
      label: 'Verified',
      cls: 'bg-green-50 border-green-200 text-green-800',
      sub: 'Your identity has been verified. You can submit reports.',
    },
    PENDING: {
      label: 'Pending Review',
      cls: 'bg-orange-50 border-orange-200 text-orange-800',
      sub: 'Your documents have been submitted and are awaiting review.',
    },
    REJECTED: {
      label: 'Rejected',
      cls: 'bg-red-50 border-red-200 text-red-800',
      sub: 'Your previous submission was rejected. Please re-submit corrected documents.',
    },
    UNVERIFIED: {
      label: 'Not Verified',
      cls: 'bg-gray-50 border-gray-200 text-gray-700',
      sub: 'Verify your identity to unlock report submission and other features.',
    },
  };

  const cfg = STATUS[status] || STATUS.UNVERIFIED;
  const canSubmit = status === 'UNVERIFIED' || status === 'REJECTED';
  const allFilesPicked = !!(files.idFront && files.idBack && files.selfie);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <ShieldCheck className="h-5 w-5 text-brand-600" /> Identity Verification
        </h2>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${cfg.cls}`}>
          {cfg.label}
        </span>
      </div>

      <p className="mb-4 text-sm text-gray-600">{cfg.sub}</p>

      {profile.rejectionReason && status === 'REJECTED' && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <strong>Rejection reason:</strong> {profile.rejectionReason}
          </div>
        </div>
      )}

      {canSubmit && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KycFilePicker
              label="ID — Front"
              file={files.idFront}
              onChange={(f) => setFiles((s) => ({ ...s, idFront: f }))}
            />
            <KycFilePicker
              label="ID — Back"
              file={files.idBack}
              onChange={(f) => setFiles((s) => ({ ...s, idBack: f }))}
            />
            <KycFilePicker
              label="Selfie"
              file={files.selfie}
              onChange={(f) => setFiles((s) => ({ ...s, selfie: f }))}
            />
          </div>
          <p className="text-xs text-gray-500">
            JPEG or PNG, max 10 MB each. Your selfie will be used as your profile picture.
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => submitMutation.mutate()}
              disabled={!allFilesPicked || submitMutation.isPending}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit for Review
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KycFilePicker({
  label,
  file,
  onChange,
}: {
  label: string;
  file?: File;
  onChange: (f: File | undefined) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <label className="block cursor-pointer">
      <span className="mb-1 block text-xs font-medium text-gray-700">{label}</span>
      <div className="flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:border-brand-400 hover:bg-brand-50/30 overflow-hidden">
        {preview ? (
          // Use plain img for blob preview
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center text-gray-400">
            <Camera className="h-6 w-6" />
            <span className="mt-1 text-xs">Click to upload</span>
          </div>
        )}
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.size > 10 * 1024 * 1024) {
              toast.error(`${label}: file exceeds 10 MB limit`);
              return;
            }
            onChange(f);
          }
          e.target.value = '';
        }}
      />
    </label>
  );
}
