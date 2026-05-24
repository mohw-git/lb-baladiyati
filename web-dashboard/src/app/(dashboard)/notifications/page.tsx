'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationsApi, ApiError } from '@/lib/api';
import { formatRelative, cn } from '@/lib/utils';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslate } from '@/lib/i18n';

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  COMPLAINT_ASSIGNED: { label: 'Assignment', color: 'bg-purple-100 text-purple-700' },
  COMPLAINT_STATUS_CHANGED: { label: 'Status Change', color: 'bg-blue-100 text-blue-700' },
  COMPLAINT_COMPLETED: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  NEWS_PUBLISHED: { label: 'News', color: 'bg-orange-100 text-orange-700' },
};

export default function NotificationsPage() {
  const t = useTranslate();
  const [page, setPage] = useState(1);
  const limit = 20;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => notificationsApi.list({ page, limit }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err: ApiError) => toast.error(err.message),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      toast.success(t('notifications.markAllRead'));
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: ApiError) => toast.error(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('notifications.title')}</h1>
        </div>
        <button
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending}
          className="btn-gov-secondary"
        >
          <CheckCheck className="h-4 w-4" />
          {t('notifications.markAllRead')}
        </button>
      </div>

      <div className="gov-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : data?.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Bell className="mb-3 h-10 w-10" />
            <p className="text-sm">No notifications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data?.items.map((n) => {
              const typeInfo = TYPE_LABELS[n.type] || { label: n.type, color: 'bg-gray-100 text-gray-700' };
              return (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
                  className={cn(
                    'flex cursor-pointer items-start gap-4 px-6 py-4 transition-colors hover:bg-gray-50',
                    !n.isRead && 'bg-brand-50/50',
                  )}
                >
                  <div className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-brand-500')} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm', n.isRead ? 'text-gray-700' : 'font-semibold text-gray-900')}>{n.title}</p>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', typeInfo.color)}>{typeInfo.label}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500">{n.body}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatRelative(n.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
            <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!data.meta.hasPrevPage} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-50"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => p + 1)} disabled={!data.meta.hasNextPage} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
