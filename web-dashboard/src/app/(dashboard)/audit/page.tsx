'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { auditApi, ApiError, type AuditQuery } from '@/lib/api';
import { formatRelative } from '@/lib/utils';
import { useTranslate, auditActionLabelKey, type MessageKey } from '@/lib/i18n';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  History,
  Loader2,
  Search,
  X,
} from 'lucide-react';

/**
 * Tenant-scoped audit log. Backend hard-restricts to the caller's municipality
 * (see /audit controller). Super admins use /platform/audit for cross-tenant.
 */

// Colour mapping only — the human-readable label comes from the i18n
// catalog via `auditActionLabelKey(action)`. That guarantees every audit
// action shows up translated in EN/AR/FR rather than as a raw machine key
// like "auth.email.verification_requested".
const ACTION_COLOR: Record<string, string> = {
  'auth.login.success': 'bg-emerald-50 text-emerald-700',
  'auth.login.failed': 'bg-red-50 text-red-700',
  'auth.logout': 'bg-gray-100 text-gray-700',
  'auth.logout_all': 'bg-gray-100 text-gray-700',
  'auth.register': 'bg-blue-50 text-blue-700',
  'auth.password.change': 'bg-amber-50 text-amber-700',
  'auth.password.reset_requested': 'bg-amber-50 text-amber-700',
  'auth.password.reset_completed': 'bg-amber-50 text-amber-700',
  'auth.email.verification_requested': 'bg-blue-50 text-blue-700',
  'auth.email.verification_completed': 'bg-emerald-50 text-emerald-700',
  'auth.2fa.enable': 'bg-emerald-50 text-emerald-700',
  'auth.2fa.disable': 'bg-amber-50 text-amber-700',
  'auth.2fa.login.success': 'bg-emerald-50 text-emerald-700',
  'auth.2fa.email.enable': 'bg-emerald-50 text-emerald-700',
  'auth.2fa.email.login.success': 'bg-emerald-50 text-emerald-700',
  'auth.2fa.email.otp_requested': 'bg-blue-50 text-blue-700',
  'user.create': 'bg-blue-50 text-blue-700',
  'user.update': 'bg-blue-50 text-blue-700',
  'user.role.assign': 'bg-purple-50 text-purple-700',
  'user.role.remove': 'bg-purple-50 text-purple-700',
  'complaint.create': 'bg-indigo-50 text-indigo-700',
  'complaint.assign': 'bg-indigo-50 text-indigo-700',
  'complaint.status.change': 'bg-indigo-50 text-indigo-700',
  'complaint.reject': 'bg-red-50 text-red-700',
  'complaint.delete': 'bg-red-50 text-red-700',
  'kyc.submit': 'bg-blue-50 text-blue-700',
  'kyc.approve': 'bg-emerald-50 text-emerald-700',
  'kyc.reject': 'bg-red-50 text-red-700',
};

function actionColor(action: string): string {
  return ACTION_COLOR[action] ?? 'bg-gray-100 text-gray-700';
}

/**
 * Build a human-readable action label. If the i18n catalog has a
 * `audit.action.label.<action>` entry we render it; otherwise we
 * humanize the dotted key as a fallback so even unrecognised actions
 * read like "Complaint Assign" instead of "complaint.assign".
 */
function actionLabel(t: ReturnType<typeof useTranslate>, action: string): string {
  const key = auditActionLabelKey(action);
  const translated = t(key as MessageKey);
  if (translated && translated !== key) return translated;
  return action
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, ' '))
    .join(' · ');
}

export default function AuditPage() {
  const t = useTranslate();
  const [filters, setFilters] = useState<AuditQuery>({});
  const [draft, setDraft] = useState<AuditQuery>({});
  const [page, setPage] = useState(1);
  const limit = 50;

  const queryParams: AuditQuery = useMemo(
    () => ({ ...filters, page, limit }),
    [filters, page],
  );

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['audit', queryParams],
    queryFn: () => auditApi.list(queryParams),
  });

  const apply = () => {
    setFilters({
      action: draft.action?.trim() || undefined,
      actorId: draft.actorId?.trim() || undefined,
      resourceType: draft.resourceType?.trim() || undefined,
      resourceId: draft.resourceId?.trim() || undefined,
      from: draft.from || undefined,
      to: draft.to || undefined,
    });
    setPage(1);
  };

  const reset = () => {
    setDraft({});
    setFilters({});
    setPage(1);
  };

  const exportCsv = async () => {
    try {
      await auditApi.exportCsv(filters);
      toast.success(t('audit.exportStarted'));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t('audit.exportFailed'));
    }
  };

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('audit.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">{t('audit.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!data || data.items.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {t('common.exportCsv')}
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input
            type="text"
            placeholder={t('audit.filter.actionPlaceholder')}
            value={draft.action ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder={t('audit.filter.actorIdPlaceholder')}
            value={draft.actorId ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, actorId: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder={t('audit.filter.resourceTypePlaceholder')}
            value={draft.resourceType ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, resourceType: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder={t('audit.filter.resourceIdPlaceholder')}
            value={draft.resourceId ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, resourceId: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            type="date"
            value={draft.from ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <input
            type="date"
            value={draft.to ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          {Object.values(filters).some(Boolean) && (
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              <X className="h-4 w-4" /> {t('common.reset')}
            </button>
          )}
          <button
            type="button"
            onClick={apply}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Search className="h-4 w-4" /> {t('common.apply')}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : isError ? (
          <div className="px-6 py-16 text-center text-sm text-red-600">
            {error instanceof ApiError ? error.message : t('audit.loadFailed')}
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <History className="mb-3 h-10 w-10" />
            <p className="text-sm">{t('audit.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">{t('audit.col.when')}</th>
                  <th className="px-4 py-3">{t('audit.col.action')}</th>
                  <th className="px-4 py-3">{t('audit.col.actor')}</th>
                  <th className="px-4 py-3">{t('audit.col.resource')}</th>
                  <th className="px-4 py-3">{t('audit.col.ip')}</th>
                  <th className="px-4 py-3">{t('audit.col.details')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((row) => {
                  const color = actionColor(row.action);
                  const label = actionLabel(t, row.action);
                  return (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3 align-top text-gray-600">
                        <div className="font-medium text-gray-900">{formatRelative(row.createdAt)}</div>
                        <div className="text-[11px] text-gray-400">
                          {new Date(row.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}>
                          {label}
                        </span>
                        <div className="mt-1 font-mono text-[11px] text-gray-400">{row.action}</div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        {row.actorEmail ?? <span className="text-gray-400">{t('audit.anonymous')}</span>}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        {row.resourceType ? (
                          <>
                            <div>{row.resourceType}</div>
                            {row.resourceId && (
                              <div className="font-mono text-[11px] text-gray-400">{row.resourceId}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-[12px] text-gray-500">
                        {row.ipAddress ?? '—'}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-600">
                        {row.metadata ? (
                          <details>
                            <summary className="cursor-pointer text-xs text-brand-600 hover:underline">
                              {t('audit.detailsView')}
                            </summary>
                            <pre className="mt-1 max-w-md overflow-auto rounded bg-gray-50 p-2 text-[11px] text-gray-700">
                              {JSON.stringify(row.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
            <p className="text-sm text-gray-500">
              {isFetching ? `${t('common.loading')} ` : ''}
              {t('audit.pageStatus', {
                page: data.meta.page,
                totalPages,
                total: data.meta.total,
              })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
