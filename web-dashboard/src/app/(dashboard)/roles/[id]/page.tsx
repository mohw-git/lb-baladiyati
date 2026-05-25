'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { rolesApi, ApiError } from '@/lib/api';
import { PERMISSION_MODULES } from '@shared/constants/permissions';
import type { Permission } from '@shared/types/role';
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocale, useTranslate, isRtl, permissionLabelKey, systemRoleLabelKey, type MessageKey } from '@/lib/i18n';
import { pickName, pickDescription } from '@shared/types/locale';

export default function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const myRank: number = (user as any)?.effectiveRank ?? 0;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    nameFr: '',
    description: '',
    descriptionAr: '',
    descriptionFr: '',
    priority: 0,
  });
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [permissionIdsDirty, setPermissionIdsDirty] = useState(false);
  const locale = useLocale();
  const t = useTranslate();
  const rtl = isRtl(locale);

  const { data: role, isLoading } = useQuery({
    queryKey: ['role', id],
    queryFn: () => rolesApi.getById(id),
  });

  const { data: permissions } = useQuery({
    queryKey: ['roles', 'permissions'],
    queryFn: () => rolesApi.listPermissions(),
    enabled: !!role,
  });

  useEffect(() => {
    if (role) {
      setForm({
        name: role.name,
        nameAr: (role as any).nameAr || '',
        nameFr: (role as any).nameFr || '',
        description: role.description || '',
        descriptionAr: (role as any).descriptionAr || '',
        descriptionFr: (role as any).descriptionFr || '',
        priority: (role as any).priority ?? 0,
      });
      setPermissionIds(role.permissions?.map((p) => p.id) ?? []);
    }
  }, [role]);

  const permissionByKey = useMemo(() => {
    const map = new Map<string, Permission>();
    (permissions || []).forEach((p) => map.set(p.key, p));
    return map;
  }, [permissions]);

  const togglePermission = (permId: string) => {
    setPermissionIds((prev) =>
      prev.includes(permId)
        ? prev.filter((x) => x !== permId)
        : [...prev, permId]
    );
    setPermissionIdsDirty(true);
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      rolesApi.update(id, {
        name: form.name,
        nameAr: form.nameAr || undefined,
        nameFr: form.nameFr || undefined,
        description: form.description || undefined,
        descriptionAr: form.descriptionAr || undefined,
        descriptionFr: form.descriptionFr || undefined,
        priority: form.priority,
      } as any),
    onSuccess: () => {
      toast.success(t('roles.toast.updated'));
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['role', id] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const setPermissionsMutation = useMutation({
    mutationFn: () => rolesApi.setPermissions(id, { permissionIds }),
    onSuccess: () => {
      toast.success(t('roles.toast.permissionsUpdated'));
      setPermissionIdsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['role', id] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => rolesApi.remove(id),
    onSuccess: () => {
      toast.success(t('roles.toast.deleted'));
      router.push('/roles');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="py-20 text-center text-sm text-gray-500">{t('roles.empty')}</div>
    );
  }

  const isProtectedSystemRole = role.isSystem;

  const sysKey = systemRoleLabelKey(role.name);
  const localizedRoleName = sysKey ? t(sysKey) : pickName(role as any, locale);
  const sysDescKey = sysKey ? `${sysKey}.desc` as MessageKey : null;
  const localizedRoleDesc = sysDescKey ? t(sysDescKey) : pickDescription(role as any, locale);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <Link
          href="/roles"
          className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /> {t('common.backTo.roles')}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{localizedRoleName}</h1>
            {localizedRoleDesc && (
              <p className="mt-1 text-sm text-gray-500">{localizedRoleDesc}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
              {t('common.priority')} {(role as any).priority ?? 0}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                role.isSystem ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {role.isSystem ? t('roles.badge.protected') : t('common.user')}
            </span>
          </div>
        </div>
      </div>

      {isProtectedSystemRole && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t('roles.protectedNotice')}
        </div>
      )}

      <div className="gov-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="gov-section-header">{t('roles.detail.title')}</div>
          {!isProtectedSystemRole && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-brand-600 hover:text-brand-700"
            >
              {t('common.edit')}
            </button>
          )}
        </div>
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('roles.form.name')}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="input-gov"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('roles.form.nameAr')}
                </label>
                <input type="text" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" className="input-gov" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('roles.form.nameFr')}
                </label>
                <input type="text" value={form.nameFr} onChange={(e) => setForm({ ...form, nameFr: e.target.value })} className="input-gov" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('common.description_en')}</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input-gov" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('common.description_ar')}</label>
                <textarea value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} rows={2} dir="rtl" className="input-gov" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('common.description_fr')}</label>
                <textarea value={form.descriptionFr} onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })} rows={2} className="input-gov" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('roles.field.priority')}
              </label>
              <input
                type="number"
                min={0}
                max={Math.max(0, myRank - 1)}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
                className="input-gov w-32"
              />
              <p className="mt-1 text-xs text-gray-500">{t('roles.field.priorityHint')}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(false)} className="btn-gov-secondary">{t('common.cancel')}</button>
              <button
                type="submit"
                disabled={updateMutation.isPending || form.priority >= myRank}
                className="btn-gov-primary"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        ) : (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">{t('common.name')}</dt>
              <dd className="font-medium text-gray-900">{localizedRoleName}</dd>
            </div>
            {localizedRoleDesc && (
              <div>
                <dt className="text-gray-500">{t('common.description')}</dt>
                <dd className="text-gray-900">{localizedRoleDesc}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {!isProtectedSystemRole && (
        <div className="gov-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="gov-section-header">{t('roles.detail.permissions')}</div>
            {permissionIdsDirty && (
              <button
                onClick={() => setPermissionsMutation.mutate()}
                disabled={setPermissionsMutation.isPending}
                className="btn-gov-primary"
              >
                {setPermissionsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('common.save')}
              </button>
            )}
          </div>
          <div className="space-y-3 rounded border border-gray-200 bg-gray-50/50 p-3">
            {Object.entries(PERMISSION_MODULES).map(([moduleKey, module]) => {
              const modulePermissions = module.items
                .map((item) => permissionByKey.get(item.key))
                .filter(Boolean) as Permission[];
              if (modulePermissions.length === 0) return null;
              return (
                <div key={moduleKey} className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {t(module.moduleLabelKey as MessageKey)}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {modulePermissions.map((perm) => (
                      <label key={perm.id} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={permissionIds.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">
                          {t(permissionLabelKey(perm.key))}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isProtectedSystemRole && role.permissions && role.permissions.length > 0 && (
        <div className="gov-card p-4">
          <div className="gov-section-header mb-3">{t('roles.detail.permissions')}</div>
          <p className="text-xs text-gray-500">{t('roles.protectedNotice')}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {role.permissions.map((perm) => (
              <li
                key={perm.id}
                className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
              >
                {t(permissionLabelKey(perm.key))}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isProtectedSystemRole && (
        <div className="gov-card p-4">
          <div className="gov-section-header">{t('roles.detail.dangerZone')}</div>
          <button
            onClick={() => {
              if (confirm(t('roles.detail.deleteConfirm').replace('{name}', localizedRoleName))) {
                deleteMutation.mutate();
              }
            }}
            disabled={deleteMutation.isPending}
            className="mt-3 flex items-center gap-1.5 rounded border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {t('roles.detail.delete')}
          </button>
        </div>
      )}
    </div>
  );
}
