'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Megaphone } from 'lucide-react';
import { platformAnnouncementsApi } from '@/lib/api/endpoints/platform-announcements';
import type { PlatformAnnouncementStatus } from '@shared/types/platform-announcement';
import { formatDate } from '@/lib/utils';
import { useTranslate } from '@/lib/i18n';
import { ApiError } from '@/lib/api';

function StatusBadge({ status }: { status: PlatformAnnouncementStatus }) {
  const t = useTranslate();
  const styles: Record<PlatformAnnouncementStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    PUBLISHED: 'bg-emerald-50 text-emerald-800',
    ARCHIVED: 'bg-amber-50 text-amber-900',
  };
  const labelKey = {
    DRAFT: 'platform.announcements.status.draft',
    PUBLISHED: 'platform.announcements.status.published',
    ARCHIVED: 'platform.announcements.status.archived',
  } as const;
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${styles[status]}`}>
      {t(labelKey[status])}
    </span>
  );
}

export default function PlatformAnnouncementsPage() {
  const t = useTranslate();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PlatformAnnouncementStatus | ''>('');
  const [expired, setExpired] = useState<'all' | 'yes' | 'no'>('all');
  const limit = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['platform-announcements-admin', page, status, expired],
    queryFn: () =>
      platformAnnouncementsApi.listAdmin({
        page,
        limit,
        status: status || undefined,
        expired: expired === 'yes' ? true : expired === 'no' ? false : undefined,
      }),
  });

  const archiveMut = useMutation({
    mutationFn: (id: string) => platformAnnouncementsApi.archive(id),
    onSuccess: () => {
      toast.success(t('platform.announcements.toast.archived'));
      qc.invalidateQueries({ queryKey: ['platform-announcements-admin'] });
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const isExpired = (expiresAt?: string | null) =>
    expiresAt ? new Date(expiresAt) < new Date() : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Megaphone className="h-5 w-5" />
            {t('platform.announcements.title')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('platform.announcements.subtitle')}</p>
        </div>
        <Link href="/platform/announcements/new" className="btn-gov-primary">
          <Plus className="h-4 w-4" /> {t('platform.announcements.create')}
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="input-gov text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PlatformAnnouncementStatus | '');
            setPage(1);
          }}
        >
          <option value="">{t('platform.announcements.filter.allStatuses')}</option>
          <option value="DRAFT">{t('platform.announcements.status.draft')}</option>
          <option value="PUBLISHED">{t('platform.announcements.status.published')}</option>
          <option value="ARCHIVED">{t('platform.announcements.status.archived')}</option>
        </select>
        <select
          className="input-gov text-sm"
          value={expired}
          onChange={(e) => {
            setExpired(e.target.value as 'all' | 'yes' | 'no');
            setPage(1);
          }}
        >
          <option value="all">{t('platform.announcements.filter.allExpiry')}</option>
          <option value="no">{t('platform.announcements.filter.active')}</option>
          <option value="yes">{t('platform.announcements.filter.expired')}</option>
        </select>
      </div>

      <div className="gov-card overflow-hidden">
        <table className="gov-table w-full">
          <thead>
            <tr>
              <th>{t('platform.announcements.col.title')}</th>
              <th>{t('platform.announcements.col.status')}</th>
              <th>{t('platform.announcements.col.publishAt')}</th>
              <th>{t('platform.announcements.col.expiresAt')}</th>
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
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-gray-500">
                  {t('platform.announcements.empty')}
                </td>
              </tr>
            ) : (
              data?.items.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium text-gray-900">
                    {row.title}
                    {row.isPinned ? (
                      <span className="ms-2 text-[10px] font-semibold text-amber-700">
                        {t('platform.announcements.pinned')}
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={row.status} />
                      {row.status === 'PUBLISHED' && isExpired(row.expiresAt) ? (
                        <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          {t('platform.announcements.status.expired')}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="text-sm text-gray-600">
                    {row.publishAt ? formatDate(row.publishAt) : '—'}
                  </td>
                  <td className="text-sm text-gray-600">
                    {row.expiresAt ? formatDate(row.expiresAt) : '—'}
                  </td>
                  <td className="text-end">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={`/platform/announcements/${row.id}`}
                        className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                        title={t('platform.announcements.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      {row.status !== 'ARCHIVED' ? (
                        <button
                          type="button"
                          onClick={() => archiveMut.mutate(row.id)}
                          className="rounded px-2 py-1 text-[10px] font-medium text-amber-800 hover:bg-amber-50"
                        >
                          {t('platform.announcements.archive')}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data?.meta && data.meta.totalPages > 1 ? (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={!data.meta.hasPrevPage}
            onClick={() => setPage((p) => p - 1)}
            className="btn-gov-secondary text-xs disabled:opacity-40"
          >
            {t('common.previous')}
          </button>
          <span className="flex items-center text-xs text-gray-500">
            {page} / {data.meta.totalPages}
          </span>
          <button
            type="button"
            disabled={!data.meta.hasNextPage}
            onClick={() => setPage((p) => p + 1)}
            className="btn-gov-secondary text-xs disabled:opacity-40"
          >
            {t('common.next')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
