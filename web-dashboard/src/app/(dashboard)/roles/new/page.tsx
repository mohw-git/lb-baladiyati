'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { rolesApi, ApiError } from '@/lib/api';
import { PERMISSION_MODULES } from '@shared/constants/permissions';
import type { Permission } from '@shared/types/role';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useTranslate, useLocale, isRtl, permissionLabelKey, type MessageKey } from '@/lib/i18n';

export default function CreateRolePage() {
  const router = useRouter();
  const { user } = useAuth();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const myRank: number = (user as any)?.effectiveRank ?? 0;
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    nameFr: '',
    description: '',
    descriptionAr: '',
    descriptionFr: '',
    priority: Math.max(0, myRank - 10),
  });
  const [permissionIds, setPermissionIds] = useState<string[]>([]);

  const { data: permissions, isLoading: permissionsLoading } = useQuery({
    queryKey: ['roles', 'permissions'],
    queryFn: () => rolesApi.listPermissions(),
  });

  const permissionByKey = useMemo(() => {
    const map = new Map<string, Permission>();
    (permissions || []).forEach((p) => map.set(p.key, p));
    return map;
  }, [permissions]);

  const togglePermission = (id: string) => {
    setPermissionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const createMutation = useMutation({
    mutationFn: () =>
      rolesApi.create({
        name: form.name,
        nameAr: form.nameAr || undefined,
        nameFr: form.nameFr || undefined,
        description: form.description || undefined,
        descriptionAr: form.descriptionAr || undefined,
        descriptionFr: form.descriptionFr || undefined,
        priority: form.priority,
        permissionIds,
      }),
    onSuccess: (role) => {
      toast.success(t('roles.toast.created'));
      router.push(`/roles/${role.id}`);
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <Link
          href="/roles"
          className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /> {t('common.backTo.roles')}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{t('roles.new')}</h1>
      </div>

      <div className="gov-card p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
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
              <input
                type="text"
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                dir="rtl"
                className="input-gov"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('roles.form.nameFr')}
              </label>
              <input
                type="text"
                value={form.nameFr}
                onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                className="input-gov"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('common.description_en')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="input-gov"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('common.description_ar')}
              </label>
              <textarea
                value={form.descriptionAr}
                onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                rows={2}
                dir="rtl"
                className="input-gov"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('common.description_fr')}
              </label>
              <textarea
                value={form.descriptionFr}
                onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })}
                rows={2}
                className="input-gov"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('roles.field.priority')} *
            </label>
            <input
              type="number"
              min={0}
              max={Math.max(0, myRank - 1)}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
              required
              className="input-gov w-32"
            />
            <p className="mt-1 text-xs text-gray-500">
              {t('roles.field.priorityHint')}
            </p>
            {form.priority >= myRank && (
              <p className="mt-1 text-xs text-red-600">
                {t('validation.priorityRange')}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('roles.detail.permissions')}
            </label>
            {permissionsLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
              </div>
            ) : (
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
                          <label
                            key={perm.id}
                            className="flex cursor-pointer items-center gap-2"
                          >
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
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Link href="/roles" className="btn-gov-secondary">
              {t('common.cancel')}
            </Link>
            <button
              type="submit"
              disabled={createMutation.isPending || form.priority >= myRank}
              className="btn-gov-primary"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {t('roles.new')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
