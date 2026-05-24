'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2,
  ArrowLeft,
  UserPlus,
  Send,
  Trash2,
  Clock,
  Calendar,
  Building2,
} from 'lucide-react';
import { ApiError, tasksApi, usersApi, transfersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/hooks';
import { PERMISSIONS } from '@shared/constants/permissions';
import { formatDate } from '@/lib/utils';
import type { TaskStatus } from '@shared/types/task';
import { TransferModal } from '@/components/transfers/transfer-modal';
import { TransferTimeline } from '@/components/transfers/transfer-timeline';
import { useTranslate, useLocale, isRtl, pickName, taskStatusKey, complaintPriorityKey, type MessageKey } from '@/lib/i18n';

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const qc = useQueryClient();
  const { user } = useAuth();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);

  const [showAssign, setShowAssign] = useState(false);
  const [pickedAssignee, setPickedAssignee] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => tasksApi.getById(id),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'task-dept', task?.departmentId],
    queryFn: () => usersApi.list({ excludeCitizens: true, limit: 200 }),
    enabled: showAssign && !!task,
  });
  const candidates = (usersData?.items ?? []).filter(
    (u: any) => u.department?.id === task?.departmentId,
  );

  // Transfer history for the timeline
  const { data: history } = useQuery({
    queryKey: ['task', id, 'transfers'],
    queryFn: async () => {
      const res = await transfersApi.list({ targetType: 'TASK', limit: 100 });
      return res.items.filter((t) => t.targetId === id);
    },
    enabled: !!task,
  });

  const assign = useMutation({
    mutationFn: () => tasksApi.assign(id, pickedAssignee),
    onSuccess: () => {
      toast.success(t('tasks.toast.assigned'));
      setShowAssign(false);
      setPickedAssignee('');
      qc.invalidateQueries({ queryKey: ['task', id] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const changeStatus = useMutation({
    mutationFn: (status: TaskStatus) => tasksApi.changeStatus(id, status),
    onSuccess: () => {
      toast.success(t('tasks.toast.statusChanged'));
      qc.invalidateQueries({ queryKey: ['task', id] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: () => tasksApi.remove(id),
    onSuccess: () => {
      toast.success(t('tasks.toast.deleted'));
      router.push('/tasks');
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!task) return null;

  const canAssign = user?.permissions?.includes(PERMISSIONS.TASK_ASSIGN);
  const canChangeStatus =
    user?.permissions?.includes(PERMISSIONS.TASK_CHANGE_STATUS) &&
    (task.assignedToId === user.id ||
      user.permissions?.includes(PERMISSIONS.TASK_VIEW_DEPARTMENT) ||
      user.permissions?.includes(PERMISSIONS.TASK_VIEW_ALL));
  const canTransfer = user?.permissions?.includes(PERMISSIONS.TRANSFER_REQUEST);
  const canDelete = user?.permissions?.includes(PERMISSIONS.TASK_DELETE);

  return (
    <div className="space-y-4">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className={rtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} /> {t('common.backTo.tasks')}
      </Link>

      <div className="gov-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
            {task.description && (
              <p className="mt-2 max-w-2xl whitespace-pre-wrap text-sm text-gray-700">
                {task.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={task.status}
              onChange={(e) => canChangeStatus && changeStatus.mutate(e.target.value as TaskStatus)}
              disabled={!canChangeStatus || changeStatus.isPending}
              className="select-gov disabled:bg-gray-50"
            >
              {(['NEW', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'] as TaskStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t(taskStatusKey(s) as MessageKey)}
                </option>
              ))}
            </select>
            {canDelete && (
              <button
                onClick={() => {
                  if (confirm(t('tasks.detail.deleteConfirm').replace('{title}', task.title))) remove.mutate();
                }}
                className="inline-flex items-center gap-1 rounded bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" /> {t('common.delete')}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              <Building2 className="h-3.5 w-3.5" /> {t('common.department')}
            </div>
            <div className="mt-1 text-sm font-medium text-gray-900">
              {task.department ? pickName(task.department as any, locale) : '—'}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              <UserPlus className="h-3.5 w-3.5" /> {t('common.assignedTo')}
            </div>
            <div className="mt-1 text-sm text-gray-900">
              {task.assignedTo ? (
                <>{task.assignedTo.firstName} {task.assignedTo.lastName}</>
              ) : (
                <span className="italic text-gray-500">{t('common.unassigned')}</span>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              <Clock className="h-3.5 w-3.5" /> {t('common.priority')}
            </div>
            <div className="mt-1 text-sm font-medium text-gray-900">
              {t(complaintPriorityKey(task.priority) as MessageKey)}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-gray-500">
              <Calendar className="h-3.5 w-3.5" /> {t('common.dueDate')}
            </div>
            <div className="mt-1 text-sm text-gray-900">
              {task.dueDate ? formatDate(task.dueDate) : '—'}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
          {canAssign && (
            <button
              onClick={() => setShowAssign(true)}
              className="inline-flex items-center gap-1.5 rounded bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
            >
              <UserPlus className="h-4 w-4" />
              {t('tasks.detail.assign')}
            </button>
          )}
          {canTransfer && (
            <button
              onClick={() => setShowTransfer(true)}
              className="inline-flex items-center gap-1.5 rounded bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100"
            >
              <Send className="h-4 w-4" /> {t('complaints.detail.action.transfer')}
            </button>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          {task.createdBy?.firstName} {task.createdBy?.lastName} · {formatDate(task.createdAt)}
        </p>
      </div>

      {history && history.length > 0 && (
        <TransferTimeline transfers={history} />
      )}

      {showAssign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !assign.isPending && setShowAssign(false)}
        >
          <div
            className="w-full max-w-md rounded border border-gray-200 bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-gray-900">{t('tasks.detail.assign')}</h3>
            <select
              value={pickedAssignee}
              onChange={(e) => setPickedAssignee(e.target.value)}
              className="select-gov mt-4"
            >
              <option value="">—</option>
              {candidates.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.email})
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowAssign(false)} className="btn-gov-secondary">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => assign.mutate()}
                disabled={!pickedAssignee || assign.isPending}
                className="btn-gov-primary"
              >
                {t('tasks.detail.assign')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransfer && task.department && (
        <TransferModal
          targetType="TASK"
          targetId={id}
          targetTitle={task.title}
          fromDepartmentId={task.departmentId}
          fromDepartmentName={pickName(task.department as any, locale)}
          onClose={() => setShowTransfer(false)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ['task', id] })}
        />
      )}
    </div>
  );
}
