'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { usersApi, rolesApi, departmentsApi, ApiError } from '@/lib/api';
import { kycApi } from '@/lib/api/endpoints/kyc';
import type { User } from '@shared/types/user';
import { getFullName, formatDate, cn } from '@/lib/utils';
import { ArrowLeft, Loader2, Save, ShieldPlus, X, ShieldCheck, ShieldOff, AlertTriangle } from 'lucide-react';
import { usePermission, useAuth } from '@/lib/auth';
import { PERMISSIONS } from '@shared/constants/permissions';
import { useTranslate, useLocale, isRtl, pickName, systemRoleLabelKey, type MessageKey } from '@/lib/i18n';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', departmentId: '', isActive: true });
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycAction, setKycAction] = useState<'VERIFIED' | 'UNVERIFIED'>('VERIFIED');
  const [kycReason, setKycReason] = useState('');

  const canManageKyc = usePermission(PERMISSIONS.KYC_REVIEW);
  const { user: me } = useAuth();
  const myRank: number = (me as any)?.effectiveRank ?? 0;

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['user', id],
    queryFn: () => usersApi.getById(id),
  });

  useEffect(() => {
    if (user) {
      setForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '', departmentId: user.department?.id || '', isActive: user.isActive });
    }
  }, [user]);

  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list() });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() });

  const updateMutation = useMutation({
    mutationFn: () => usersApi.update(id, { firstName: form.firstName, lastName: form.lastName, phone: form.phone || undefined, departmentId: form.departmentId || undefined, isActive: form.isActive }),
    onSuccess: () => { toast.success(t('users.toast.updated')); setEditing(false); queryClient.invalidateQueries({ queryKey: ['user', id] }); },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const assignRoleMutation = useMutation({
    mutationFn: () => usersApi.assignRole(id, { roleId: selectedRoleId }),
    onSuccess: () => { toast.success(t('users.toast.roleAssigned')); setShowRoleModal(false); setSelectedRoleId(''); queryClient.invalidateQueries({ queryKey: ['user', id] }); },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const removeRoleMutation = useMutation({
    mutationFn: (roleId: string) => usersApi.removeRole(id, roleId),
    onSuccess: () => { toast.success(t('users.toast.roleRemoved')); queryClient.invalidateQueries({ queryKey: ['user', id] }); },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const kycOverrideMutation = useMutation({
    mutationFn: () => kycApi.manualOverride(id, { status: kycAction, reason: kycReason }),
    onSuccess: () => {
      toast.success(
        kycAction === 'VERIFIED' ? t('users.toast.markedVerified') : t('users.toast.verificationReset'),
      );
      setShowKycModal(false);
      setKycReason('');
      queryClient.invalidateQueries({ queryKey: ['user', id] });
      queryClient.invalidateQueries({ queryKey: ['kyc-submissions'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (!user) return <div className="py-20 text-center text-gray-500">{t('users.detail.notFound')}</div>;

  // Discord-style hierarchy gating: I can only manage users strictly below my rank
  // (or myself). Server enforces too; this just hides the controls upfront.
  const targetRank: number = (user as any).effectiveRank ?? 0;
  const isSelf = (me as any)?.id === user.id;
  const canManageThisUser = isSelf || (me as any)?.isSuperAdmin || myRank > targetRank;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <Link href="/users" className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /> {t('common.backTo.users')}
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{getFullName(user)}</h1>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
              {t('common.priority')} {targetRank}
            </span>
            <span className={cn('rounded px-2 py-0.5 text-xs font-medium', user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
              {user.isActive ? t('common.active') : t('common.inactive')}
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500">{user.email} · {formatDate(user.createdAt)}</p>
      </div>

      {!canManageThisUser && (
        <div className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{t('users.detail.cannotEdit')}</span>
        </div>
      )}

      <div className="gov-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="gov-section-header">{t('users.detail.section.profile')}</div>
          {!editing && canManageThisUser && (
            <button onClick={() => setEditing(true)} className="text-sm text-brand-600 hover:text-brand-700">
              {t('common.edit')}
            </button>
          )}
        </div>
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.firstName')}</label>
                <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input-gov" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.lastName')}</label>
                <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input-gov" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.phone')}</label>
              <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-gov" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.department')}</label>
              <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="select-gov">
                <option value="">{t('categories.form.noDept')}</option>
                {(departments as any[] || []).map((d: any) => (
                  <option key={d.id} value={d.id}>{pickName(d, locale)}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
              {t('common.active')}
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="btn-gov-secondary">{t('common.cancel')}</button>
              <button type="submit" disabled={updateMutation.isPending} className="btn-gov-primary">
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('common.save')}
              </button>
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-500">{t('common.department')}</dt><dd className="font-medium text-gray-900">{user.department ? pickName(user.department as any, locale) : '—'}</dd></div>
            <div><dt className="text-gray-500">{t('common.phone')}</dt><dd className="font-medium text-gray-900">{user.phone || '—'}</dd></div>
          </dl>
        )}
      </div>

      {canManageKyc && canManageThisUser && (
        <div className="gov-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="gov-section-header">{t('users.detail.section.kyc')}</div>
            <KycStatusBadge status={(user as any).verificationStatus || 'UNVERIFIED'} t={t} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(user as any).verificationStatus !== 'VERIFIED' && (
              <button
                onClick={() => { setKycAction('VERIFIED'); setShowKycModal(true); }}
                className="flex items-center gap-1.5 rounded border border-green-700 bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                <ShieldCheck className="h-4 w-4" /> {t('users.detail.markVerified')}
              </button>
            )}
            {(user as any).verificationStatus === 'VERIFIED' && (
              <button
                onClick={() => { setKycAction('UNVERIFIED'); setShowKycModal(true); }}
                className="flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                <ShieldOff className="h-4 w-4" /> {t('users.detail.resetVerification')}
              </button>
            )}
            {(user as any).verificationStatus === 'PENDING' && (
              <Link
                href="/kyc"
                className="btn-gov-secondary"
              >
                {t('kyc.btn.review')}
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="gov-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="gov-section-header">{t('users.detail.section.roles')}</div>
          {canManageThisUser && (
            <button onClick={() => setShowRoleModal(true)} className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
              <ShieldPlus className="h-4 w-4" /> {t('roles.btn.assign')}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {user.roles?.length === 0 && <p className="text-sm text-gray-500">{t('roles.empty')}</p>}
          {user.roles?.map((r: any) => {
            const rolePriority = r.priority ?? 0;
            const canRemove = canManageThisUser && (myRank > rolePriority || (me as any)?.isSuperAdmin);
            const k = systemRoleLabelKey(r.name);
            const displayName = k ? t(k) : pickName(r, locale);
            return (
              <span key={r.id} className="flex items-center gap-1.5 rounded bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                {displayName}
                <span className="text-[10px] font-semibold text-gray-400">·{rolePriority}</span>
                {canRemove && (
                  <button onClick={() => { if (confirm(t('users.detail.removeRole').replace('{name}', displayName))) removeRoleMutation.mutate(r.id); }} className="text-gray-400 hover:text-red-500">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </div>

      {showKycModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowKycModal(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start gap-3">
              <div className={cn('rounded-full p-2', kycAction === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                {kycAction === 'VERIFIED' ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900">
                  {kycAction === 'VERIFIED' ? t('users.detail.markVerified') : t('users.detail.resetVerification')}
                </h3>
                <p className="text-sm text-gray-500">
                  {getFullName(user)}
                </p>
              </div>
            </div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('helpRequests.field.reason')} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={kycReason}
              onChange={(e) => setKycReason(e.target.value)}
              rows={3}
              placeholder={t('helpRequests.field.reason.placeholder')}
              className="input-gov mb-4"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowKycModal(false)} className="btn-gov-secondary">{t('common.cancel')}</button>
              <button
                onClick={() => kycOverrideMutation.mutate()}
                disabled={kycOverrideMutation.isPending || kycReason.trim().length < 5}
                className={cn(
                  'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50',
                  kycAction === 'VERIFIED' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700',
                )}
              >
                {kycOverrideMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowRoleModal(false)}>
          <div className="w-full max-w-sm rounded border border-gray-200 bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-base font-semibold">{t('roles.btn.assign')}</h3>
            <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} className="select-gov mb-4">
              <option value="">—</option>
              {(roles as any[] || [])
                .filter((r: any) =>
                    !r.isSystemManaged &&
                    !user.roles?.find((ur: any) => ur.id === r.id) &&
                    ((r.priority ?? 0) < myRank || (me as any)?.isSuperAdmin),
                )
                .sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0))
                .map((r: any) => {
                  const k = systemRoleLabelKey(r.name);
                  return (
                    <option key={r.id} value={r.id}>
                      {k ? t(k) : pickName(r, locale)} · {r.priority ?? 0}
                    </option>
                  );
                })}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRoleModal(false)} className="btn-gov-secondary">{t('common.cancel')}</button>
              <button onClick={() => assignRoleMutation.mutate()} disabled={!selectedRoleId || assignRoleMutation.isPending} className="btn-gov-primary">
                {t('roles.btn.assign')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KycStatusBadge({ status, t }: { status: string; t: (k: MessageKey) => string }) {
  const cls: Record<string, string> = {
    VERIFIED: 'bg-green-50 text-green-700 border-green-200',
    PENDING: 'bg-orange-50 text-orange-700 border-orange-200',
    REJECTED: 'bg-red-50 text-red-700 border-red-200',
    UNVERIFIED: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  const labelKey: Record<string, MessageKey> = {
    VERIFIED: 'kyc.status.APPROVED',
    PENDING: 'kyc.status.PENDING',
    REJECTED: 'kyc.status.REJECTED',
    UNVERIFIED: 'kyc.status.PENDING',
  };
  return (
    <span className={cn('inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold', cls[status] || cls.UNVERIFIED)}>
      {t(labelKey[status] || labelKey.UNVERIFIED)}
    </span>
  );
}
