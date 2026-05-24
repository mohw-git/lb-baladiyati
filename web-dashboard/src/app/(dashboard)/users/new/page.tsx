'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { usersApi, departmentsApi, rolesApi, ApiError } from '@/lib/api';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import { useTranslate, useLocale, isRtl, pickName, systemRoleLabelKey } from '@/lib/i18n';

export default function CreateUserPage() {
  const router = useRouter();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', departmentId: '' });

  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => departmentsApi.list() });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list() });

  const [selectedRoleId, setSelectedRoleId] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      const user = await usersApi.create({
        email: form.email, password: form.password, firstName: form.firstName,
        lastName: form.lastName, phone: form.phone || undefined, departmentId: form.departmentId || undefined,
      });
      if (selectedRoleId && user.id) {
        await usersApi.assignRole(user.id, { roleId: selectedRoleId });
      }
      return user;
    },
    onSuccess: (user) => { toast.success(t('users.toast.created')); router.push(`/users/${user.id}`); },
    onError: (err: ApiError) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <Link href="/users" className="mb-2 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /> {t('common.backTo.users')}
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{t('users.new')}</h1>
      </div>

      <div className="gov-card p-4">
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.firstName')} *</label>
              <input type="text" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required
                className="input-gov" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.lastName')} *</label>
              <input type="text" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required
                className="input-gov" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.email')} *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
              className="input-gov" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.password')} *</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8}
              className="input-gov" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.phone')}</label>
            <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-gov" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.department')}</label>
            <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              className="select-gov">
              <option value="">{t('categories.form.noDept')}</option>
              {(departments as any[] || []).map((d: any) => (
                <option key={d.id} value={d.id}>{pickName(d, locale)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">{t('users.field.role')}</label>
            <select value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}
              className="select-gov">
              <option value="">—</option>
              {(roles as any[] || [])
                .filter((r: any) => !r.isSystemManaged)
                .map((r: any) => {
                  const k = systemRoleLabelKey(r.name);
                  return (
                    <option key={r.id} value={r.id}>
                      {k ? t(k) : pickName(r, locale)}
                    </option>
                  );
                })}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Link href="/users" className="btn-gov-secondary">{t('common.cancel')}</Link>
            <button type="submit" disabled={createMutation.isPending} className="btn-gov-primary">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('users.new')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
