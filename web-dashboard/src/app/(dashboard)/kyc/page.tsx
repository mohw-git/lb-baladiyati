'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { kycApi, type KycSubmission } from '@/lib/api/endpoints/kyc';
import { ShieldCheck, Clock, CheckCircle, XCircle, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslate, useLocale, isRtl, type MessageKey } from '@/lib/i18n';

const STATUS_CONFIG: Record<string, { labelKey: MessageKey; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING: { labelKey: 'kyc.status.PENDING', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <Clock className="h-4 w-4" /> },
  VERIFIED: { labelKey: 'kyc.status.APPROVED', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: <CheckCircle className="h-4 w-4" /> },
  REJECTED: { labelKey: 'kyc.status.REJECTED', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <XCircle className="h-4 w-4" /> },
  UNVERIFIED: { labelKey: 'kyc.status.PENDING', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: <ShieldCheck className="h-4 w-4" /> },
};

export default function KycListPage() {
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['kyc-submissions', page, statusFilter],
    queryFn: () => kycApi.list({ page, limit: 20, status: statusFilter || undefined }),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const items = data?.items || [];
  const meta = data?.meta;

  const filterButtons: { key: string; labelKey: MessageKey }[] = [
    { key: '', labelKey: 'kyc.filter.all' },
    { key: 'PENDING', labelKey: 'kyc.status.PENDING' },
    { key: 'VERIFIED', labelKey: 'kyc.status.APPROVED' },
    { key: 'REJECTED', labelKey: 'kyc.status.REJECTED' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ShieldCheck className="h-5 w-5" /> {t('kyc.title')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('kyc.subtitle')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filterButtons.map((b) => {
          const active = statusFilter === b.key;
          return (
            <button
              key={b.key}
              onClick={() => { setStatusFilter(b.key); setPage(1); }}
              className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(b.labelKey)}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      ) : isError ? (
        <div className="rounded border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          {t('kyc.loadFailed')}
        </div>
      ) : items.length === 0 ? (
        <div className="gov-card py-12 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">{t('kyc.empty')}</p>
        </div>
      ) : (
        <div className="gov-card overflow-hidden">
          <table className="gov-table w-full">
            <thead>
              <tr>
                <th>{t('kyc.col.citizen')}</th>
                <th>{t('kyc.col.status')}</th>
                <th>{t('kyc.col.submitted')}</th>
                <th>{t('common.attachments')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((sub: KycSubmission) => {
                const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.UNVERIFIED;
                return (
                  <tr key={sub.id}>
                    <td>
                      <div className="font-medium text-gray-900">
                        {sub.user.firstName} {sub.user.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{sub.user.email}</div>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
                        {cfg.icon} {t(cfg.labelKey)}
                      </span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(sub.submittedAt), { addSuffix: true })}
                    </td>
                    <td className="text-sm text-gray-500">
                      {sub.attachments?.length || 0}
                    </td>
                    <td>
                      <Link
                        href={`/kyc/${sub.id}`}
                        className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <Eye className="h-3.5 w-3.5" /> {t('kyc.btn.review')}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <span className="text-xs text-gray-500">
                {t('audit.pageStatus')
                  .replace('{page}', String(meta.page))
                  .replace('{totalPages}', String(meta.totalPages))
                  .replace('{total}', String(meta.total))}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={!meta.hasPrevPage}
                  className="rounded border border-gray-200 p-1.5 text-gray-500 disabled:opacity-30"
                >
                  {rtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!meta.hasNextPage}
                  className="rounded border border-gray-200 p-1.5 text-gray-500 disabled:opacity-30"
                >
                  {rtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
