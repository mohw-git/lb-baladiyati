'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Loader2,
  Plus,
  ListChecks,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pause,
} from 'lucide-react';
import { tasksApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/hooks';
import { PERMISSIONS } from '@shared/constants/permissions';
import type { Task, TaskStatus } from '@shared/types/task';
import { formatDate } from '@/lib/utils';
import { useTranslate } from '@/lib/i18n';

const STATUS_TABS: { id: TaskStatus | 'all'; labelKey: string; icon: any }[] = [
  { id: 'all', labelKey: 'common.all', icon: ListChecks },
  { id: 'NEW', labelKey: 'tasks.status.PENDING', icon: AlertTriangle },
  { id: 'IN_PROGRESS', labelKey: 'tasks.status.IN_PROGRESS', icon: Clock },
  { id: 'BLOCKED', labelKey: 'common.unknown', icon: Pause },
  { id: 'DONE', labelKey: 'tasks.status.COMPLETED', icon: CheckCircle2 },
];

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-100 text-red-700',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  NEW: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  BLOCKED: 'bg-purple-100 text-purple-800',
  DONE: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

export default function TasksPage() {
  const { user } = useAuth();
  const t = useTranslate();
  const [tab, setTab] = useState<TaskStatus | 'all'>('all');
  const [scope, setScope] = useState<'all' | 'mine' | 'created'>('all');
  const [search, setSearch] = useState('');

  const canCreate = user?.permissions?.includes(PERMISSIONS.TASK_CREATE);

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', { tab, scope, search }],
    queryFn: () =>
      tasksApi.list({
        status: tab === 'all' ? undefined : tab,
        myAssignments: scope === 'mine' || undefined,
        myTasks: scope === 'created' || undefined,
        q: search || undefined,
        limit: 100,
      }),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const tasks: Task[] = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('tasks.title')}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('tasks.subtitle')}</p>
        </div>
        {canCreate && (
          <Link href="/tasks/new" className="btn-gov-primary shrink-0">
            <Plus className="h-4 w-4" /> {t('tasks.new')}
          </Link>
        )}
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tabItem) => {
          const Icon = tabItem.icon;
          return (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold ${
                tab === tabItem.id
                  ? 'bg-brand-700 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {t(tabItem.labelKey as any)}
            </button>
          );
        })}
      </div>

      {/* Scope + search */}
      <div className="gov-card flex flex-wrap items-center gap-2 p-3">
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as any)}
          className="select-gov"
        >
          <option value="all">{t('common.all')}</option>
          <option value="mine">{t('complaints.bucket.assignedToMe')}</option>
          <option value="created">{t('common.submittedBy')}</option>
        </select>
        <input
          type="search"
          placeholder={t('common.search') + '…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-gov min-w-[200px] flex-1"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
          No tasks match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Assigned to</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tasks.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => (window.location.href = `/tasks/${t.id}`)}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="font-medium text-gray-900 hover:text-brand-600"
                    >
                      {t.title}
                    </Link>
                    {t.description && (
                      <div className="mt-0.5 max-w-md truncate text-xs text-gray-500">
                        {t.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.department?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.assignedTo ? (
                      <>
                        {t.assignedTo.firstName} {t.assignedTo.lastName}
                      </>
                    ) : (
                      <span className="italic text-gray-400">unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        PRIORITY_COLORS[t.priority]
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[t.status]
                      }`}
                    >
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {t.dueDate ? formatDate(t.dueDate) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
