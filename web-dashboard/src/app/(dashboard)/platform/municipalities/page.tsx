'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ApiError,
  platformApi,
  type MunicipalityStarterTemplate,
  type PlatformMunicipality,
} from '@/lib/api';
import { Loader2, Plus, Power, PowerOff, UserCog, AlertTriangle, Crown, Mail, Map, MapPin } from 'lucide-react';
import { useLocale, useTranslate } from '@/lib/i18n';
import { pickName } from '@shared/types/locale';
import { ActionMenu } from '@/components/ui/action-menu';

interface CreateForm {
  name: string;
  nameAr: string;
  nameFr: string;
  code: string;
  starterTemplate: MunicipalityStarterTemplate;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}

const emptyForm: CreateForm = {
  name: '',
  nameAr: '',
  nameFr: '',
  code: '',
  starterTemplate: 'FULL_GOVERNMENT',
  adminEmail: '',
  adminPassword: '',
  adminFirstName: '',
  adminLastName: '',
};

export default function PlatformMunicipalitiesPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslate();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateForm>(emptyForm);
  const [transferTarget, setTransferTarget] = useState<PlatformMunicipality | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState<string>('');
  const [revokePrev, setRevokePrev] = useState<boolean>(true);
  const locale = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'municipalities'],
    queryFn: () => platformApi.listMunicipalities(true),
  });

  const munis: PlatformMunicipality[] = Array.isArray(data) ? data : (data as any)?.data ?? [];
  const munisWithoutAdmin = munis.filter((m) => m.isActive && !m.adminUserId && !m.admin);

  const createMutation = useMutation({
    mutationFn: () =>
      platformApi.createMunicipality({
        ...form,
        nameAr: form.nameAr || undefined,
        nameFr: form.nameFr || undefined,
        code: form.code.toUpperCase(),
      }),
    onSuccess: () => {
      toast.success(t('platform.municipalities.toast.created'));
      setShowCreate(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ['platform', 'municipalities'] });
      queryClient.invalidateQueries({ queryKey: ['platform'] });
      queryClient.invalidateQueries({ queryKey: ['complaints', 'department-workload'] });
      queryClient.invalidateQueries({ queryKey: ['platform', 'users'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      platformApi.updateMunicipality(id, { isActive }),
    onSuccess: () => {
      toast.success(t('platform.municipalities.toast.updated'));
      queryClient.invalidateQueries({ queryKey: ['platform', 'municipalities'] });
      queryClient.invalidateQueries({ queryKey: ['platform'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const applyStarterCategoriesMutation = useMutation({
    mutationFn: (municipalityId: string) => platformApi.applyStarterCategories(municipalityId),
    onSuccess: () => {
      toast.success(t('platform.municipalities.toast.starterCategories'));
      queryClient.invalidateQueries({ queryKey: ['platform', 'municipalities'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      platformApi.transferMunicipalityAdmin(
        transferTarget!.id,
        { newAdminEmail: newAdminEmail.trim() },
        revokePrev,
      ),
    onSuccess: () => {
      toast.success(t('platform.municipalities.toast.transferAdmin'));
      setTransferTarget(null);
      setNewAdminEmail('');
      queryClient.invalidateQueries({ queryKey: ['platform', 'municipalities'] });
      queryClient.invalidateQueries({ queryKey: ['platform'] });
      queryClient.invalidateQueries({ queryKey: ['complaints', 'department-workload'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('platform.municipalities.title')}</h1>
          <p className="mt-0.5 text-sm text-gray-600">{t('platform.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/platform/boundaries"
            className="btn-gov-secondary flex items-center gap-2 text-sm"
          >
            <MapPin className="h-4 w-4" />
            {t('nav.boundaryAssignment')}
          </Link>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded border border-amber-700 bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            {t('platform.municipalities.new')}
          </button>
        </div>
      </div>

      {munisWithoutAdmin.length > 0 && (
        <div className="flex items-start gap-3 rounded border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              {munisWithoutAdmin.length}: {t('departments.overview.legend.muniVacant')}
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="gov-card overflow-hidden">
          <table className="gov-table w-full">
            <thead>
              <tr>
                <th>{t('platform.municipalities.col.name')}</th>
                <th>{t('platform.municipalities.col.code')}</th>
                <th>{t('platform.municipalities.col.admin')}</th>
                <th>{t('platform.municipalities.col.users')}</th>
                <th>{t('platform.municipalities.col.departments')}</th>
                <th>{t('platform.municipalities.col.complaints')}</th>
                <th>{t('platform.municipalities.col.status')}</th>
                <th className="text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {munis.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-gray-500">
                    {t('platform.municipalities.empty')}
                  </td>
                </tr>
              )}
              {munis.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="font-medium text-gray-900">{pickName(m as any, locale)}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="text-gray-600">{m.code}</td>
                  <td>
                    {m.admin ? (
                      <div className="flex items-center gap-2">
                        <Crown className="h-3.5 w-3.5 text-amber-500" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {m.admin.firstName} {m.admin.lastName}
                          </div>
                          <div className="text-xs text-gray-500">{m.admin.email}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> {t('departments.hod.vacant')}
                      </span>
                    )}
                  </td>
                  <td className="text-gray-600">{m._count?.users ?? 0}</td>
                  <td className="text-gray-600">{m._count?.departments ?? 0}</td>
                  <td className="text-gray-600">{m._count?.complaints ?? 0}</td>
                  <td>
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {m.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <ActionMenu
                        ariaLabel={t('common.actions')}
                        items={[
                          {
                            key: 'advanced-boundary',
                            label: t('platform.boundary.viewAdvancedEditor'),
                            icon: <Map className="h-3.5 w-3.5" />,
                            onClick: () =>
                              router.push(`/platform/municipalities/${m.id}/boundary`),
                          },
                          ...((m._count?.complaintCategories ?? 0) === 0 &&
                          (m._count?.departments ?? 0) > 0
                            ? [
                                {
                                  key: 'apply-starter-categories',
                                  label: t('platform.municipalities.applyStarterCategories'),
                                  onClick: () => {
                                    if (
                                      window.confirm(
                                        t('platform.municipalities.applyStarterCategories.confirm'),
                                      )
                                    ) {
                                      applyStarterCategoriesMutation.mutate(m.id);
                                    }
                                  },
                                },
                              ]
                            : []),
                        ]}
                      />
                      <button
                        onClick={() => {
                          setTransferTarget(m);
                          setNewAdminEmail('');
                          setRevokePrev(true);
                        }}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                          m.admin
                            ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        }`}
                      >
                        <UserCog className="h-3 w-3" />
                        {m.admin ? t('platform.btn.transferAdmin') : t('platform.btn.setAdmin')}
                      </button>
                      <button
                        onClick={() => toggleMutation.mutate({ id: m.id, isActive: !m.isActive })}
                        disabled={toggleMutation.isPending}
                        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                          m.isActive
                            ? 'bg-red-50 text-red-700 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {m.isActive ? (
                          <><PowerOff className="h-3 w-3" /> {t('common.disabled')}</>
                        ) : (
                          <><Power className="h-3 w-3" /> {t('common.active')}</>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {transferTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !transferMutation.isPending && setTransferTarget(null)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">
              {t('platform.btn.transferAdmin')} — {pickName(transferTarget as any, locale)}
            </h3>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  {t('common.email')}
                </span>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    autoFocus
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder={t('users.field.email')}
                    className="input-gov pl-9"
                  />
                </div>
              </label>

              <label className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={revokePrev}
                  onChange={(e) => setRevokePrev(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span>{t('users.detail.removeRole').replace('{name}', t('roles.system.admin'))}</span>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setTransferTarget(null)} className="btn-gov-secondary">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => transferMutation.mutate()}
                disabled={!newAdminEmail.trim() || transferMutation.isPending}
                className="btn-gov-primary"
              >
                {transferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('platform.btn.transferAdmin')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !createMutation.isPending && setShowCreate(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-base font-bold text-gray-900">{t('platform.municipalities.new')}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('municipality.settings.name.en')}
                  </label>
                  <input
                    required
                    minLength={3}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input-gov"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('municipality.settings.code')}
                  </label>
                  <input
                    required
                    minLength={2}
                    maxLength={10}
                    pattern="[A-Za-z0-9]+"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="input-gov uppercase"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('municipality.settings.name.ar')}
                  </label>
                  <input
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    dir="rtl"
                    className="input-gov"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('municipality.settings.name.fr')}
                  </label>
                  <input
                    value={form.nameFr}
                    onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                    className="input-gov"
                  />
                </div>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('platform.municipalities.starterTemplate.label')}
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  {t('platform.municipalities.starterTemplate.hint')}
                </p>
                <select
                  value={form.starterTemplate}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      starterTemplate: e.target.value as MunicipalityStarterTemplate,
                    })
                  }
                  className="select-gov"
                >
                  <option value="FULL_GOVERNMENT">
                    {t('platform.municipalities.starterTemplate.full')} —{' '}
                    {t('platform.municipalities.starterTemplate.fullDesc')}
                  </option>
                  <option value="DEPARTMENTS_ONLY">
                    {t('platform.municipalities.starterTemplate.departmentsOnly')} —{' '}
                    {t('platform.municipalities.starterTemplate.departmentsOnlyDesc')}
                  </option>
                  <option value="BLANK">
                    {t('platform.municipalities.starterTemplate.blank')} —{' '}
                    {t('platform.municipalities.starterTemplate.blankDesc')}
                  </option>
                </select>
              </div>

              <div className="border-t border-gray-200 pt-3">
                <p className="mb-3 text-sm font-semibold text-gray-700">{t('roles.system.admin')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('users.field.firstName')}
                    </label>
                    <input
                      required
                      value={form.adminFirstName}
                      onChange={(e) => setForm({ ...form, adminFirstName: e.target.value })}
                      className="input-gov"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('users.field.lastName')}
                    </label>
                    <input
                      required
                      value={form.adminLastName}
                      onChange={(e) => setForm({ ...form, adminLastName: e.target.value })}
                      className="input-gov"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{t('common.email')}</label>
                    <input
                      type="email"
                      required
                      value={form.adminEmail}
                      onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                      className="input-gov"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('users.field.password')}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={form.adminPassword}
                      onChange={(e) => setForm({ ...form, adminPassword: e.target.value })}
                      className="input-gov"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  disabled={createMutation.isPending}
                  className="btn-gov-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 rounded border border-amber-700 bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('platform.btn.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
