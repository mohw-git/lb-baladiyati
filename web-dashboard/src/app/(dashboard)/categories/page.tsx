'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { categoriesApi, departmentsApi, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Loader2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import type { Category } from '@shared/types/category';
import { useLocale, useTranslate } from '@/lib/i18n';
import { pickName } from '@shared/types/locale';
import { useAnyPermission, useAuth, usePermission } from '@/lib/auth';
import { PERMISSIONS } from '@shared/constants/permissions';
import { hasMunicipalityWideCategoryManagement } from '@shared/utils/category-access';

export default function CategoriesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const locale = useLocale();
  const t = useTranslate();
  const { user } = useAuth();
  const canManageCategories = useAnyPermission(
    PERMISSIONS.CATEGORY_CREATE,
    PERMISSIONS.CATEGORY_UPDATE,
  );
  const canDeleteCategories = usePermission(PERMISSIONS.CATEGORY_DELETE);
  const isMunicipalityWide = useMemo(
    () => hasMunicipalityWideCategoryManagement(user?.permissions ?? []),
    [user?.permissions],
  );
  const userDepartmentId = user?.department?.id ?? null;

  useEffect(() => {
    if (!canManageCategories) {
      router.replace('/dashboard');
    }
  }, [canManageCategories, router]);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    nameFr: '',
    icon: '',
    departmentId: '',
  });

  const { data: categoriesRaw, isLoading } = useQuery({
    queryKey: ['categories', 'admin'],
    queryFn: () => categoriesApi.list({ includeAll: true }),
  });

  const categories: Category[] = Array.isArray(categoriesRaw)
    ? categoriesRaw
    : (categoriesRaw as any)?.data ?? [];

  const visibleCategories = useMemo(() => {
    if (isMunicipalityWide) return categories;
    if (!userDepartmentId) return [];
    return categories.filter(
      (c) => c.department?.id === userDepartmentId || (c as any).departmentId === userDepartmentId,
    );
  }, [categories, isMunicipalityWide, userDepartmentId]);

  const { data: departmentsRaw } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
    enabled: isMunicipalityWide,
  });

  const departments = Array.isArray(departmentsRaw)
    ? departmentsRaw
    : (departmentsRaw as any)?.data ?? [];

  const submitDepartmentId = isMunicipalityWide
    ? form.departmentId || undefined
    : userDepartmentId || undefined;

  const createMutation = useMutation({
    mutationFn: () =>
      categoriesApi.create({
        name: form.name,
        nameAr: form.nameAr || undefined,
        nameFr: form.nameFr || undefined,
        icon: form.icon || undefined,
        departmentId: submitDepartmentId,
      }),
    onSuccess: () => {
      toast.success(t('categories.toast.created'));
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) =>
      toast.error(err instanceof ApiError ? err.message : t('categories.toast.createFailed')),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      editing
        ? categoriesApi.update(editing.id, {
            name: form.name,
            nameAr: form.nameAr || undefined,
            nameFr: form.nameFr || undefined,
            icon: form.icon || undefined,
            ...(isMunicipalityWide
              ? { departmentId: form.departmentId || undefined }
              : {}),
          })
        : Promise.reject(new Error('No category')),
    onSuccess: () => {
      toast.success(t('categories.toast.updated'));
      setShowModal(false);
      setEditing(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) =>
      toast.error(err instanceof ApiError ? err.message : t('categories.toast.updateFailed')),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.activate(id),
    onSuccess: () => {
      toast.success(t('categories.toast.activated'));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => toast.error(err instanceof ApiError ? err.message : t('common.error')),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.deactivate(id),
    onSuccess: () => {
      toast.success(t('categories.toast.deactivated'));
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => toast.error(err instanceof ApiError ? err.message : t('common.error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: () => {
      toast.success(t('categories.toast.deleted'));
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err: any) => toast.error(err instanceof ApiError ? err.message : t('common.error')),
  });

  const resetForm = () =>
    setForm({
      name: '',
      nameAr: '',
      nameFr: '',
      icon: '',
      departmentId: isMunicipalityWide ? '' : userDepartmentId ?? '',
    });

  const openAddModal = () => {
    setEditing(null);
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (c: Category) => {
    setEditing(c);
    setForm({
      name: c.name,
      nameAr: (c as any).nameAr || '',
      nameFr: (c as any).nameFr || '',
      icon: c.icon || '',
      departmentId: c.department?.id || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const handleToggleActive = (c: Category) => {
    if (c.isActive) {
      deactivateMutation.mutate(c.id);
    } else {
      activateMutation.mutate(c.id);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isToggling = activateMutation.isPending || deactivateMutation.isPending;

  if (!canManageCategories) {
    return null;
  }

  return (
    <div className="space-y-4">
      {!isMunicipalityWide && !userDepartmentId && (
        <div className="flex items-start gap-3 rounded border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">{t('categories.hod.noDepartment')}</p>
        </div>
      )}

      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('categories.title')}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('categories.subtitle')}</p>
        </div>
        {(isMunicipalityWide || userDepartmentId) && (
          <button onClick={openAddModal} className="btn-gov-primary">
            <Plus className="h-4 w-4" /> {t('categories.new')}
          </button>
        )}
      </div>

      <div className="gov-card overflow-hidden">
        <table className="gov-table w-full">
          <thead>
            <tr>
              <th>{t('categories.col.name')}</th>
              <th>{t('categories.col.icon')}</th>
              <th>{t('categories.col.department')}</th>
              <th>{t('categories.col.complaints')}</th>
              <th>{t('categories.col.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : !visibleCategories.length ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-500">
                  {t('categories.empty')}
                </td>
              </tr>
            ) : (
              visibleCategories.map((c) => (
                <tr key={c.id} className={cn(!c.isActive && 'opacity-60')}>
                  <td className="font-medium text-gray-900">{pickName(c as any, locale)}</td>
                  <td className="text-gray-500">{c.icon || '—'}</td>
                  <td className="text-gray-600">
                    {c.department ? pickName(c.department as any, locale) : '—'}
                  </td>
                  <td className="text-gray-500">
                    {(c as any)._count?.complaints ?? '—'}
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleActive(c)}
                      disabled={isToggling}
                      className="flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {c.isActive ? (
                        <>
                          <ToggleRight className="h-5 w-5 text-green-600" />
                          <span className="text-xs font-medium text-green-700">
                            {t('categories.status.active')}
                          </span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-5 w-5 text-gray-400" />
                          <span className="text-xs font-medium text-red-600">
                            {t('categories.status.inactive')}
                          </span>
                        </>
                      )}
                    </button>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(c)}
                        className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
                      >
                        <Pencil className="h-4 w-4" /> {t('common.edit')}
                      </button>
                      {canDeleteCategories && (
                        <button
                          onClick={() => setDeleteTarget(c)}
                          className="flex items-center gap-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded border border-gray-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              {editing ? t('categories.modal.edit') : t('categories.modal.add')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('categories.form.name')}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="input-gov"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('categories.form.nameAr')}
                </label>
                <input
                  type="text"
                  dir="rtl"
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  placeholder="مثال: حفر الطرق"
                  className="input-gov"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('categories.form.nameFr')}
                </label>
                <input
                  type="text"
                  value={form.nameFr}
                  onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                  placeholder="ex. Nids-de-poule"
                  className="input-gov"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('categories.form.icon')}
                </label>
                <input
                  type="text"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  placeholder={t('categories.form.icon.placeholder')}
                  className="input-gov"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('categories.form.department')}
                </label>
                {isMunicipalityWide ? (
                  <select
                    value={form.departmentId}
                    onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                    className="select-gov"
                  >
                    <option value="">{t('categories.form.noDept')}</option>
                    {departments.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {pickName(d, locale)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                    {user?.department ? pickName(user.department as any, locale) : '—'}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-gov-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={isPending} className="btn-gov-primary">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editing ? t('common.save') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Deactivate Confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded border border-gray-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold text-gray-900">
              {t('categories.modal.deactivate')}
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              {t('categories.confirm.deactivate').replace('{name}', deleteTarget.name)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-gov-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 rounded border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t('categories.status.inactive')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
