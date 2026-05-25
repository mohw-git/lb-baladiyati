'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { departmentsApi, usersApi, ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  UserCog,
  UserX,
  Crown,
  Users,
  Mail,
  X,
} from 'lucide-react';
import type { Department } from '@shared/types/department';
import type { DepartmentWithHead, DepartmentMember } from '@/lib/api';
import { useLocale, useTranslate } from '@/lib/i18n';
import { pickName, pickDescription } from '@shared/types/locale';

export default function DepartmentsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DepartmentWithHead | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentWithHead | null>(null);
  const [headTarget, setHeadTarget] = useState<DepartmentWithHead | null>(null);
  const [pickedHead, setPickedHead] = useState<string>('');
  const [membersTarget, setMembersTarget] = useState<DepartmentWithHead | null>(null);
  const [memberEmail, setMemberEmail] = useState<string>('');
  const [form, setForm] = useState({
    name: '',
    nameAr: '',
    nameFr: '',
    description: '',
    descriptionAr: '',
    descriptionFr: '',
  });
  const t = useTranslate();
  const locale = useLocale();

  const { data: departmentsRaw, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  });

  const departments: DepartmentWithHead[] = Array.isArray(departmentsRaw)
    ? departmentsRaw
    : (departmentsRaw as any)?.data ?? [];

  const vacantCount = departments.filter((d) => !d.headUserId).length;

  // HOD candidates: staff already in this department + unassigned municipal staff (can be moved in).
  const { data: hodDeptMembers, isLoading: hodCandidatesLoading } = useQuery({
    queryKey: ['departments', headTarget?.id, 'members'],
    queryFn: () => departmentsApi.listMembers(headTarget!.id),
    enabled: !!headTarget,
  });

  const { data: hodUnassignedStaff } = useQuery({
    queryKey: ['users', 'hod-unassigned', headTarget?.id],
    queryFn: () => usersApi.list({ excludeCitizens: true, limit: 200 }),
    enabled: !!headTarget,
  });

  const hodCandidates = useMemo(() => {
    if (!headTarget) return [];
    const inDept = (hodDeptMembers?.members ?? []).filter(
      (m) => m.id !== headTarget.headUserId && m.isActive,
    );
    const unassigned = (hodUnassignedStaff?.items ?? []).filter(
      (u) =>
        !u.department?.id &&
        u.id !== headTarget.headUserId &&
        u.isActive !== false,
    );
    const byId = new Map<string, { id: string; firstName: string; lastName: string; email: string }>();
    for (const m of inDept) {
      byId.set(m.id, {
        id: m.id,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
      });
    }
    for (const u of unassigned) {
      if (!byId.has(u.id)) {
        byId.set(u.id, {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
        });
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
    );
  }, [headTarget, hodDeptMembers, hodUnassignedStaff]);

  const buildPayload = () => ({
    name: form.name,
    nameAr: form.nameAr || undefined,
    nameFr: form.nameFr || undefined,
    description: form.description || undefined,
    descriptionAr: form.descriptionAr || undefined,
    descriptionFr: form.descriptionFr || undefined,
  });

  const createMutation = useMutation({
    mutationFn: () => departmentsApi.create(buildPayload() as any),
    onSuccess: () => {
      toast.success(t('departments.toast.created'));
      setShowModal(false);
      setForm({ name: '', nameAr: '', nameFr: '', description: '', descriptionAr: '', descriptionFr: '' });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      editing
        ? departmentsApi.update(editing.id, buildPayload() as any)
        : Promise.reject(new Error('No department')),
    onSuccess: () => {
      toast.success(t('departments.toast.updated'));
      setShowModal(false);
      setEditing(null);
      setForm({ name: '', nameAr: '', nameFr: '', description: '', descriptionAr: '', descriptionFr: '' });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: () => {
      toast.success(t('departments.toast.deleted'));
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const setHeadMutation = useMutation({
    mutationFn: () => departmentsApi.setHead(headTarget!.id, pickedHead),
    onSuccess: (res) => {
      toast.success(t('departments.toast.hodSet').replace('{email}', res.newHeadEmail));
      setHeadTarget(null);
      setPickedHead('');
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const vacateHeadMutation = useMutation({
    mutationFn: (id: string) => departmentsApi.vacateHead(id),
    onSuccess: () => {
      toast.success(t('departments.toast.hodVacated'));
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const { data: membersData, isFetching: membersLoading } = useQuery({
    queryKey: ['departments', membersTarget?.id, 'members'],
    queryFn: () => departmentsApi.listMembers(membersTarget!.id),
    enabled: !!membersTarget,
  });
  const currentMembers: DepartmentMember[] = membersData?.members ?? [];

  const addMemberMutation = useMutation({
    mutationFn: () =>
      departmentsApi.addMember(membersTarget!.id, memberEmail.trim()),
    onSuccess: (res) => {
      if (res.alreadyMember) {
        toast.info(t('departments.toast.memberExists').replace('{email}', res.email));
      } else {
        toast.success(t('departments.toast.memberAdded').replace('{email}', res.email));
      }
      setMemberEmail('');
      queryClient.invalidateQueries({
        queryKey: ['departments', membersTarget?.id, 'members'],
      });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['org-chart'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      departmentsApi.removeMember(membersTarget!.id, userId),
    onSuccess: () => {
      toast.success(t('departments.toast.memberRemoved'));
      queryClient.invalidateQueries({
        queryKey: ['departments', membersTarget?.id, 'members'],
      });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['org-chart'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const openAddModal = () => {
    setEditing(null);
    setForm({ name: '', nameAr: '', nameFr: '', description: '', descriptionAr: '', descriptionFr: '' });
    setShowModal(true);
  };

  const openEditModal = (d: DepartmentWithHead) => {
    setEditing(d);
    setForm({
      name: d.name,
      nameAr: (d as any).nameAr || '',
      nameFr: (d as any).nameFr || '',
      description: d.description || '',
      descriptionAr: (d as any).descriptionAr || '',
      descriptionFr: (d as any).descriptionFr || '',
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

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('departments.title')}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('departments.subtitle')}</p>
        </div>
        <button onClick={openAddModal} className="btn-gov-primary">
          <Plus className="h-4 w-4" /> {t('departments.modal.add')}
        </button>
      </div>

      {vacantCount > 0 && (
        <div className="flex items-start gap-3 rounded border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="text-sm text-amber-900">
            <p className="font-semibold">
              {t('departments.hod.warning.vacant').replace('{count}', String(vacantCount))}
            </p>
          </div>
        </div>
      )}

      <div className="gov-card overflow-hidden">
        <table className="gov-table w-full">
          <thead>
            <tr>
              <th>{t('departments.col.name')}</th>
              <th>{t('departments.hod.label')}</th>
              <th>{t('departments.col.staff')}</th>
              <th>{t('departments.col.created')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : !departments?.length ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-gray-500">
                  {t('departments.empty')}
                </td>
              </tr>
            ) : (
              departments.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="font-medium text-gray-900">{pickName(d, locale)}</div>
                    {pickDescription(d, locale) && (
                      <div className="max-w-xs truncate text-xs text-gray-500">
                        {pickDescription(d, locale)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    {d.head ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                          <Crown className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {d.head.firstName} {d.head.lastName}
                          </div>
                          <div className="text-xs text-gray-500">{d.head.email}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> {t('departments.hod.vacant')}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => {
                        setMembersTarget(d);
                        setMemberEmail('');
                      }}
                      className="inline-flex items-center gap-1.5 rounded bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {d._count?.users ?? 0}
                    </button>
                  </td>
                  <td className="text-gray-500">{formatDate(d.createdAt)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setMembersTarget(d);
                          setMemberEmail('');
                        }}
                        className="flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                      >
                        <Users className="h-3.5 w-3.5" />
                        {t('departments.btn.members')}
                      </button>
                      <button
                        onClick={() => {
                          setHeadTarget(d);
                          setPickedHead('');
                        }}
                        className="flex items-center gap-1 rounded bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                      >
                        <UserCog className="h-3.5 w-3.5" />
                        {d.head ? t('departments.btn.changeHead') : t('departments.btn.setHead')}
                      </button>
                      {d.head && (
                        <button
                          onClick={() => {
                            if (confirm(t('departments.btn.vacateHod') + ` "${d.name}"?`)) {
                              vacateHeadMutation.mutate(d.id);
                            }
                          }}
                          className="flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                        >
                          <UserX className="h-3.5 w-3.5" /> {t('departments.btn.vacateHod')}
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(d)}
                        className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(d)}
                        className="flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Members modal */}
      {membersTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() =>
            !addMemberMutation.isPending && setMembersTarget(null)
          }
        >
          <div
            className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">
                  {t('departments.modal.members')} — {pickName(membersTarget, locale)}
                </h3>
              </div>
              <button
                onClick={() => setMembersTarget(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                addMemberMutation.mutate();
              }}
              className="mt-4 flex gap-2"
            >
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder={t('departments.member.email.placeholder')}
                  className="w-full rounded border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <button
                type="submit"
                disabled={!memberEmail.trim() || addMemberMutation.isPending}
                className="btn-gov-primary"
              >
                {addMemberMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {t('departments.member.add')}
              </button>
            </form>

            <div className="mt-5 max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200">
              {membersLoading ? (
                <div className="py-10 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                </div>
              ) : currentMembers.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  {t('departments.member.empty')}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {currentMembers.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between px-4 py-2.5 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                          {m.firstName.charAt(0)}
                          {m.lastName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-gray-900">
                            {m.firstName} {m.lastName}
                            {m.isHead && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
                                title="Head of Department"
                              >
                                <Crown className="h-2.5 w-2.5" />
                                HOD
                              </span>
                            )}
                            {!m.isActive && (
                              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">
                                {t('common.inactive')}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {m.email}
                            {m.roles.length > 0 && (
                              <span className="ml-1 text-gray-400">
                                · {m.roles.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (m.isHead) {
                            toast.error(t('departments.btn.vacateHod'));
                            return;
                          }
                          if (confirm(`${m.firstName} ${m.lastName}?`)) {
                            removeMemberMutation.mutate(m.id);
                          }
                        }}
                        disabled={removeMemberMutation.isPending}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('departments.member.remove')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Set Head modal */}
      {headTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !setHeadMutation.isPending && setHeadTarget(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">
              {t('departments.modal.setHod')} — {pickName(headTarget, locale)}
            </h3>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('departments.hod.select.placeholder')}
              </label>
              <select
                value={pickedHead}
                onChange={(e) => setPickedHead(e.target.value)}
                className="select-gov"
              >
                <option value="">—</option>
                {hodCandidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName} ({u.email})
                  </option>
                ))}
              </select>
              {hodCandidatesLoading ? (
                <p className="mt-2 text-xs text-gray-500">{t('common.loading')}</p>
              ) : hodCandidates.length === 0 ? (
                <div className="mt-2 space-y-1 text-xs text-amber-700">
                  <p>{t('departments.hod.emptyEligible')}</p>
                  <p className="text-amber-600">{t('departments.hod.emptyHint')}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setHeadTarget(null)}
                className="btn-gov-secondary"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => setHeadMutation.mutate()}
                disabled={!pickedHead || setHeadMutation.isPending}
                className="btn-gov-primary"
              >
                {setHeadMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {t('departments.btn.setHead')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              {editing ? t('departments.modal.edit') : t('departments.modal.add')}
            </h3>
            <p className="mb-3 text-xs text-gray-500">
              {t('common.i18n_hint')}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('common.name_en')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('common.name_ar')}</label>
                  <input
                    type="text"
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    dir="rtl"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('common.name_fr')}</label>
                  <input
                    type="text"
                    value={form.nameFr}
                    onChange={(e) => setForm({ ...form, nameFr: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('common.description_en')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('common.description_ar')}</label>
                  <textarea
                    value={form.descriptionAr}
                    onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                    rows={3}
                    dir="rtl"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('common.description_fr')}</label>
                  <textarea
                    value={form.descriptionFr}
                    onChange={(e) => setForm({ ...form, descriptionFr: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-gov-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="btn-gov-primary"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editing ? t('common.save') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-base font-semibold text-gray-900">{t('common.delete')}</h3>
            <p className="mb-4 text-sm text-gray-600">
              &quot;{deleteTarget.name}&quot;
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
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
