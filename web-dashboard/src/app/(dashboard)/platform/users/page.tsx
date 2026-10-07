'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError, platformApi, type PlatformUser } from '@/lib/api';
import {
  Loader2,
  Power,
  PowerOff,
  UserCheck,
  KeyRound,
  ShieldOff,
  LogOut,
  Trash2,
  MailCheck,
} from 'lucide-react';
import { useTranslate, systemRoleLabelKey, type MessageKey } from '@/lib/i18n';
import { ActionMenu } from '@/components/ui/action-menu';

export default function PlatformUsersPage() {
  const t = useTranslate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [muniFilter, setMuniFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // Action modals
  const [pwModal, setPwModal] = useState<{ user: PlatformUser; pw: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PlatformUser | null>(null);

  const { data: munisData } = useQuery({
    queryKey: ['platform', 'municipalities', 'list-for-filter'],
    queryFn: () => platformApi.listMunicipalities(true),
  });
  const munis = Array.isArray(munisData) ? munisData : (munisData as any)?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'users', { search, muniFilter, page }],
    queryFn: () =>
      platformApi.listUsers({
        page,
        limit: 50,
        search: search || undefined,
        municipalityId: muniFilter || undefined,
      }),
  });

  const users: PlatformUser[] = data?.items ?? [];
  const meta = data?.meta;

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      platformApi.setUserActive(id, isActive),
    onSuccess: () => {
      toast.success(t('users.toast.updated'));
      queryClient.invalidateQueries({ queryKey: ['platform', 'users'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const impersonateMutation = useMutation({
    mutationFn: (id: string) => platformApi.impersonate(id),
    onSuccess: (res) => {
      const params = new URLSearchParams({
        token: res.accessToken,
        as: res.target.email,
      });
      const url = `/impersonate?${params.toString()}`;
      window.open(url, '_blank');
      toast.success(t('platform.users.btn.impersonate'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const resetPwMutation = useMutation({
    mutationFn: ({ id, pw }: { id: string; pw: string }) =>
      platformApi.resetUserPassword(id, pw),
    onSuccess: () => {
      toast.success(t('users.toast.updated'));
      setPwModal(null);
      queryClient.invalidateQueries({ queryKey: ['platform', 'users'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const reset2faMutation = useMutation({
    mutationFn: (id: string) => platformApi.resetUser2FA(id),
    onSuccess: () => {
      toast.success(t('users.toast.updated'));
      queryClient.invalidateQueries({ queryKey: ['platform', 'users'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const forceLogoutMutation = useMutation({
    mutationFn: (id: string) => platformApi.forceLogout(id),
    onSuccess: () => {
      toast.success(t('common.signOut'));
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const verifyEmailMutation = useMutation({
    mutationFn: (id: string) => platformApi.verifyUserEmail(id),
    onSuccess: (res) => {
      toast.success(
        res.alreadyVerified
          ? t('platform.users.toast.emailAlreadyVerified')
          : t('platform.users.toast.emailVerified'),
      );
      queryClient.invalidateQueries({ queryKey: ['platform', 'users'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => platformApi.deleteUser(id),
    onSuccess: () => {
      toast.success(t('common.delete'));
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['platform', 'users'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">{t('platform.users.title')}</h1>
        <p className="mt-0.5 text-sm text-gray-600">{t('platform.subtitle')}</p>
      </div>

      <div className="gov-card flex flex-wrap items-center gap-2 p-3">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t('platform.users.search.placeholder')}
          className="input-gov min-w-[240px] flex-1"
        />
        <select
          value={muniFilter}
          onChange={(e) => {
            setMuniFilter(e.target.value);
            setPage(1);
          }}
          className="select-gov"
        >
          <option value="">{t('platform.municipalities.title')}</option>
          {munis.map((m: any) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="gov-card overflow-hidden">
          <table className="gov-table w-full">
            <thead>
              <tr>
                <th>{t('common.user')}</th>
                <th>{t('common.municipality')}</th>
                <th>{t('users.col.role')}</th>
                <th>{t('common.status')}</th>
                <th className="text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-gray-500">
                    {t('users.empty')}
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-medium text-gray-900">
                      {u.firstName} {u.lastName}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      <span>{u.email}</span>
                      {u.emailVerifiedAt ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-800">
                          {t('platform.users.emailVerified')}
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                          {t('platform.users.emailUnverified')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-gray-600">
                    {u.isSuperAdmin ? (
                      <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {t('platform.banner.title')}
                      </span>
                    ) : (
                      u.municipality?.name ?? '—'
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {u.isSuperAdmin && (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          {t('platform.banner.title')}
                        </span>
                      )}
                      {u.roles.map((r) => {
                        const k = systemRoleLabelKey(r);
                        return (
                          <span
                            key={r}
                            className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                          >
                            {k ? t(k) : r}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {u.isActive ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="relative flex items-center justify-end gap-2">
                      {!u.isSuperAdmin && (
                        <button
                          onClick={() =>
                            toggleMutation.mutate({ id: u.id, isActive: !u.isActive })
                          }
                          disabled={toggleMutation.isPending}
                          className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${
                            u.isActive
                              ? 'bg-red-50 text-red-700 hover:bg-red-100'
                              : 'bg-green-50 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          {u.isActive ? (
                            <><PowerOff className="h-3 w-3" /> {t('common.disabled')}</>
                          ) : (
                            <><Power className="h-3 w-3" /> {t('common.active')}</>
                          )}
                        </button>
                      )}
                      {!u.isSuperAdmin && (
                        <ActionMenu
                          ariaLabel={t('common.actions')}
                          items={[
                            {
                              key: 'impersonate',
                              label: t('platform.users.btn.impersonate'),
                              icon: <UserCheck className="h-3.5 w-3.5" />,
                              onClick: () => impersonateMutation.mutate(u.id),
                            },
                            {
                              key: 'reset-password',
                              label: t('profile.section.security'),
                              icon: <KeyRound className="h-3.5 w-3.5" />,
                              onClick: () => setPwModal({ user: u, pw: '' }),
                            },
                            {
                              key: 'reset-2fa',
                              label: '2FA',
                              icon: <ShieldOff className="h-3.5 w-3.5" />,
                              onClick: () => reset2faMutation.mutate(u.id),
                            },
                            ...(!u.emailVerifiedAt
                              ? [
                                  {
                                    key: 'verify-email',
                                    label: t('platform.users.btn.verifyEmail'),
                                    icon: <MailCheck className="h-3.5 w-3.5" />,
                                    onClick: () => {
                                      if (
                                        window.confirm(
                                          t('platform.users.confirm.verifyEmail', {
                                            email: u.email,
                                          }),
                                        )
                                      ) {
                                        verifyEmailMutation.mutate(u.id);
                                      }
                                    },
                                  } as const,
                                ]
                              : []),
                            {
                              key: 'force-logout',
                              label: t('common.signOut'),
                              icon: <LogOut className="h-3.5 w-3.5" />,
                              onClick: () => forceLogoutMutation.mutate(u.id),
                            },
                            {
                              key: 'delete',
                              label: t('common.delete'),
                              icon: <Trash2 className="h-3.5 w-3.5" />,
                              danger: true,
                              separatorBefore: true,
                              onClick: () => setDeleteConfirm(u),
                            },
                          ]}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold">{t('profile.section.security')}</h3>
            <p className="mt-1 text-sm text-gray-600">
              <span className="font-medium">{pwModal.user.email}</span>
            </p>
            <input
              type="text"
              autoFocus
              placeholder={t('users.field.password')}
              value={pwModal.pw}
              onChange={(e) => setPwModal({ ...pwModal, pw: e.target.value })}
              className="input-gov mt-4"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setPwModal(null)} className="btn-gov-secondary">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => resetPwMutation.mutate({ id: pwModal.user.id, pw: pwModal.pw })}
                disabled={pwModal.pw.length < 8 || resetPwMutation.isPending}
                className="btn-gov-primary"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded border border-gray-200 bg-white p-6 shadow-lg">
            <h3 className="text-base font-semibold text-red-700">{t('platform.users.confirm.delete')}</h3>
            <p className="mt-1 text-sm text-gray-600">
              <span className="font-medium">{deleteConfirm.email}</span>
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="btn-gov-secondary">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 rounded border border-red-600 bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {t('audit.pageStatus')
              .replace('{page}', String(meta.page))
              .replace('{totalPages}', String(meta.totalPages))
              .replace('{total}', String(meta.total))}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="btn-gov-secondary"
            >
              {t('common.previous')}
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
              className="btn-gov-secondary"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
