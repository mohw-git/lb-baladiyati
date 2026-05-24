'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { platformApi, type AuditLogEntry } from '@/lib/api';
import {
  Loader2,
  Filter,
  Download,
  RefreshCw,
  ShieldAlert,
  LogIn,
  KeyRound,
  ScrollText,
  AlertTriangle,
  CheckCircle2,
  UserCog,
  Wrench,
  FileWarning,
} from 'lucide-react';
import { useTranslate, auditActionLabelKey, type MessageKey } from '@/lib/i18n';

/**
 * Render an audit action as a localized, human-readable label. Falls
 * back to a humanized version of the dotted key when no translation
 * exists, so newly added backend actions still display sensibly.
 */
function localizedActionLabel(
  t: ReturnType<typeof useTranslate>,
  action: string,
): string {
  const key = auditActionLabelKey(action);
  const translated = t(key as MessageKey);
  if (translated && translated !== key) return translated;
  return action
    .split('.')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).replace(/_/g, ' '))
    .join(' · ');
}

function categorize(action: string): {
  labelKey: MessageKey;
  color: string;
  icon: React.ReactNode;
} {
  if (action.startsWith('auth.login.failed') || action.includes('failed'))
    return { labelKey: 'audit.action.failedLogin', color: 'bg-red-100 text-red-800', icon: <ShieldAlert className="h-3.5 w-3.5" /> };
  if (action.startsWith('auth.login') || action.startsWith('auth.2fa.login'))
    return { labelKey: 'audit.action.signIn', color: 'bg-emerald-100 text-emerald-800', icon: <LogIn className="h-3.5 w-3.5" /> };
  if (action.startsWith('auth.logout'))
    return { labelKey: 'audit.action.signOut', color: 'bg-gray-100 text-gray-700', icon: <LogIn className="h-3.5 w-3.5 rotate-180" /> };
  if (action.startsWith('auth.2fa') || action.startsWith('auth.password') || action.startsWith('auth.avatar'))
    return { labelKey: 'audit.action.account', color: 'bg-blue-100 text-blue-800', icon: <KeyRound className="h-3.5 w-3.5" /> };
  if (action.startsWith('platform.maintenance'))
    return { labelKey: 'audit.action.maintenance', color: 'bg-amber-100 text-amber-800', icon: <Wrench className="h-3.5 w-3.5" /> };
  if (action.startsWith('platform.user') || action.startsWith('platform.impersonate') || action.startsWith('platform.municipality'))
    return { labelKey: 'audit.action.platformAdmin', color: 'bg-purple-100 text-purple-800', icon: <UserCog className="h-3.5 w-3.5" /> };
  if (action.startsWith('user.'))
    return { labelKey: 'audit.action.userMgmt', color: 'bg-indigo-100 text-indigo-800', icon: <UserCog className="h-3.5 w-3.5" /> };
  if (action.startsWith('complaint.reject'))
    return { labelKey: 'audit.action.complaintReject', color: 'bg-orange-100 text-orange-800', icon: <FileWarning className="h-3.5 w-3.5" /> };
  if (action.startsWith('complaint.'))
    return { labelKey: 'audit.action.complaint', color: 'bg-sky-100 text-sky-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> };
  if (action.startsWith('kyc.'))
    return { labelKey: 'audit.action.kyc', color: 'bg-teal-100 text-teal-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> };
  return { labelKey: 'audit.action.other', color: 'bg-gray-100 text-gray-700', icon: <ScrollText className="h-3.5 w-3.5" /> };
}

const ACTION_PRESETS: { labelKey: MessageKey; value: string }[] = [
  { labelKey: 'audit.preset.all', value: '' },
  { labelKey: 'audit.preset.failedLogins', value: 'auth.login.failed' },
  { labelKey: 'audit.preset.signIns', value: 'auth.login.success' },
  { labelKey: 'audit.preset.passwordResets', value: 'reset_password' },
  { labelKey: 'audit.preset.twoFactorChanges', value: '2fa' },
  { labelKey: 'audit.preset.platformAdmin', value: 'platform.' },
  { labelKey: 'audit.preset.kycReviews', value: 'kyc.' },
  { labelKey: 'audit.preset.maintenance', value: 'maintenance' },
];

export default function PlatformAuditPage() {
  const t = useTranslate();
  const [filters, setFilters] = useState<{
    action?: string;
    actorId?: string;
    municipalityId?: string;
    resourceType?: string;
    from?: string;
    to?: string;
  }>({});
  const [page, setPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: munisData } = useQuery({
    queryKey: ['platform', 'municipalities', 'audit-filter'],
    queryFn: () => platformApi.listMunicipalities(true),
  });
  const munis = Array.isArray(munisData) ? munisData : (munisData as any)?.data ?? [];

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['platform', 'audit', { ...filters, page }],
    queryFn: () => platformApi.queryAudit({ ...filters, page, limit: 50 }),
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  const logs: AuditLogEntry[] = data?.items ?? [];

  // Quick in-page summary — counts by category for the visible page
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const log of logs) {
      const c = t(categorize(log.action).labelKey);
      counts[c] = (counts[c] ?? 0) + 1;
    }
    return counts;
  }, [logs, t]);

  const exportCsv = () => {
    const header = [
      'timestamp',
      'actor_email',
      'action',
      'resource_type',
      'resource_id',
      'municipality',
      'ip',
      'user_agent',
      'metadata',
    ].join(',');
    const rows = logs.map((l) =>
      [
        l.createdAt,
        l.actorEmail ?? '',
        l.action,
        l.resourceType ?? '',
        l.resourceId ?? '',
        l.municipalityId ?? '',
        l.ipAddress ?? '',
        (l.userAgent ?? '').replace(/"/g, '""'),
        JSON.stringify(l.metadata ?? {}).replace(/"/g, '""'),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-page-${page}-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <ScrollText className="h-5 w-5" /> {t('platform.audit.title')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-600">{t('platform.audit.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600"
            />
            {t('audit.btn.autoRefresh')}
          </label>
          <button onClick={() => refetch()} className="btn-gov-secondary">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {t('audit.btn.refresh')}
          </button>
          <button onClick={exportCsv} className="btn-gov-secondary">
            <Download className="h-3.5 w-3.5" /> {t('common.exportCsv')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {ACTION_PRESETS.map((p) => (
          <button
            key={p.labelKey}
            onClick={() => {
              setFilters({ ...filters, action: p.value || undefined });
              setPage(1);
            }}
            className={`rounded px-3 py-1 text-xs font-medium ${
              (filters.action ?? '') === p.value
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {Object.keys(summary).length > 0 && (
        <div className="flex flex-wrap gap-2 rounded border border-gray-200 bg-gray-50 px-4 py-2 text-xs text-gray-600">
          {Object.entries(summary).map(([cat, count]) => (
            <span key={cat} className="rounded bg-white px-2 py-0.5 shadow-sm">
              {cat}: <strong>{count}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 rounded border border-gray-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2 flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('audit.filter.actionPlaceholder')}
            value={filters.action ?? ''}
            onChange={(e) => {
              setFilters({ ...filters, action: e.target.value || undefined });
              setPage(1);
            }}
            className="input-gov w-full"
          />
        </div>
        <input
          type="text"
          placeholder={t('audit.filter.resourceTypePlaceholder')}
          value={filters.resourceType ?? ''}
          onChange={(e) => {
            setFilters({ ...filters, resourceType: e.target.value || undefined });
            setPage(1);
          }}
          className="input-gov"
        />
        <select
          value={filters.municipalityId ?? ''}
          onChange={(e) => {
            setFilters({ ...filters, municipalityId: e.target.value || undefined });
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
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.from ?? ''}
            onChange={(e) => {
              setFilters({ ...filters, from: e.target.value || undefined });
              setPage(1);
            }}
            className="input-gov w-full text-xs"
            title={t('common.from')}
          />
          <input
            type="date"
            value={filters.to ?? ''}
            onChange={(e) => {
              setFilters({ ...filters, to: e.target.value || undefined });
              setPage(1);
            }}
            className="input-gov w-full text-xs"
            title={t('common.to')}
          />
        </div>
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
                <th>{t('audit.col.when')}</th>
                <th>{t('audit.col.actor')}</th>
                <th>{t('common.category')}</th>
                <th>{t('audit.col.action')}</th>
                <th>{t('audit.col.resource')}</th>
                <th>{t('audit.col.ip')}</th>
                <th>{t('audit.col.details')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <AlertTriangle className="h-8 w-8 text-gray-300" />
                      <p>{t('platform.audit.empty')}</p>
                    </div>
                  </td>
                </tr>
              )}
              {logs.map((l) => {
                const cat = categorize(l.action);
                return (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-xs text-gray-600">
                      <div className="font-medium text-gray-900">
                        {new Date(l.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="text-gray-500">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="text-gray-900">
                      {l.actorEmail ?? (
                        <span className="text-xs italic text-gray-400">{t('audit.anonymous')}</span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${cat.color}`}>
                        {cat.icon}
                        {t(cat.labelKey)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-900">
                        {localizedActionLabel(t, l.action)}
                      </div>
                      <code className="mt-0.5 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                        {l.action}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {l.resourceType ? (
                        <span className="text-xs">
                          {l.resourceType}
                          {l.resourceId && (
                            <span className="ml-1 text-gray-400">
                              {l.resourceId.slice(0, 8)}
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">
                      {l.ipAddress ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {l.metadata && Object.keys(l.metadata).length > 0 ? (
                        <details>
                          <summary className="cursor-pointer text-blue-600 hover:underline">
                            view
                          </summary>
                          <pre className="mt-2 max-w-md overflow-x-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                            {JSON.stringify(l.metadata, null, 2)}
                          </pre>
                          {l.userAgent && (
                            <p className="mt-1 max-w-md break-all text-[11px] text-gray-400">
                              UA: {l.userAgent}
                            </p>
                          )}
                        </details>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data?.meta && data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {t('audit.pageStatus')
              .replace('{page}', String(data.meta.page))
              .replace('{totalPages}', String(data.meta.totalPages))
              .replace('{total}', String(data.meta.total))}
          </p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-gov-secondary">
              {t('common.previous')}
            </button>
            <button disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)} className="btn-gov-secondary">
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
