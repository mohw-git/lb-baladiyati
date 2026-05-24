'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  ApiError,
  departmentsApi,
  tasksApi,
  usersApi,
} from '@/lib/api';
import type { TaskPriority } from '@shared/types/task';
import { useTranslate, useLocale, pickName, complaintPriorityKey } from '@/lib/i18n';

export default function NewTaskPage() {
  const router = useRouter();
  const t = useTranslate();
  const locale = useLocale();
  const [form, setForm] = useState({
    title: '',
    description: '',
    departmentId: '',
    priority: 'MEDIUM' as TaskPriority,
    dueDate: '',
    assignedToId: '',
  });

  const { data: deps } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  });
  const departments = Array.isArray(deps)
    ? deps
    : (deps as any)?.data ?? [];

  const { data: usersData } = useQuery({
    queryKey: ['users', 'task-assignees', form.departmentId],
    queryFn: () => usersApi.list({ excludeCitizens: true, limit: 200 }),
    enabled: !!form.departmentId,
  });
  const candidates = (usersData?.items ?? []).filter((u: any) =>
    !u.department?.id || u.department.id === form.departmentId,
  );

  const create = useMutation({
    mutationFn: () =>
      tasksApi.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        departmentId: form.departmentId,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        assignedToId: form.assignedToId || undefined,
      }),
    onSuccess: (task) => {
      toast.success(t('tasks.toast.created'));
      router.push(`/tasks/${task.id}`);
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.departmentId) return toast.error(t('tasks.toast.chooseDept'));
    if (form.title.trim().length < 3) return toast.error(t('validation.minChars').replace('{n}', '3'));
    create.mutate();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-xl font-bold text-gray-900">{t('tasks.title.new')}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{t('tasks.subtitle')}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="gov-card space-y-3 p-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('tasks.field.title')} *
          </label>
          <input
            required
            minLength={3}
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input-gov"
            placeholder={t('tasks.field.title.placeholder')}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('tasks.field.description')}
          </label>
          <textarea
            rows={4}
            maxLength={5000}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-gov"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('common.department')} *
            </label>
            <select
              required
              value={form.departmentId}
              onChange={(e) =>
                setForm({ ...form, departmentId: e.target.value, assignedToId: '' })
              }
              className="select-gov"
            >
              <option value="">—</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {pickName(d, locale)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('tasks.field.priority')}
            </label>
            <select
              value={form.priority}
              onChange={(e) =>
                setForm({ ...form, priority: e.target.value as TaskPriority })
              }
              className="select-gov"
            >
              <option value="LOW">{t(complaintPriorityKey('LOW'))}</option>
              <option value="MEDIUM">{t(complaintPriorityKey('MEDIUM'))}</option>
              <option value="HIGH">{t(complaintPriorityKey('HIGH'))}</option>
              <option value="URGENT">{t(complaintPriorityKey('URGENT'))}</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('tasks.field.dueDate')}
            </label>
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              className="input-gov"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('tasks.field.assignee')}
            </label>
            <select
              value={form.assignedToId}
              onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
              disabled={!form.departmentId}
              className="select-gov disabled:bg-gray-50"
            >
              <option value="">{t('common.unassigned')}</option>
              {candidates.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-3">
          <button type="button" onClick={() => router.back()} className="btn-gov-secondary">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="btn-gov-primary"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('tasks.new')}
          </button>
        </div>
      </form>
    </div>
  );
}
