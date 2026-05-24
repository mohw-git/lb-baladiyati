'use client';

import { useQuery } from '@tanstack/react-query';
import { platformApi } from '@/lib/api';
import {
  Loader2,
  Globe,
  Users,
  MessageSquareWarning,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Building2,
  ChevronRight,
  ScrollText,
  Wrench,
  Paintbrush,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { useTranslate, useLocale, complaintStatusKey, type MessageKey } from '@/lib/i18n';
import { pickName } from '@shared/types/locale';

const STATUS_PILL: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-indigo-100 text-indigo-800',
  ASSIGNED: 'bg-violet-100 text-violet-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  PENDING_APPROVAL: 'bg-orange-100 text-orange-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-gray-100 text-gray-700',
  REJECTED: 'bg-red-100 text-red-800',
};

function StatTile({
  icon: Icon,
  labelKey,
  value,
  hint,
  tone = 'neutral',
  href,
}: {
  icon: React.ElementType;
  labelKey: MessageKey;
  value: number | string;
  hint?: string;
  tone?: 'neutral' | 'alert' | 'success';
  href?: string;
}) {
  const t = useTranslate();
  const toneClass =
    tone === 'alert'
      ? 'border-red-200 bg-red-50/50'
      : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50/40'
      : 'border-gray-200 bg-white';
  const valueClass =
    tone === 'alert'
      ? 'text-red-700'
      : tone === 'success'
      ? 'text-emerald-700'
      : 'text-gray-900';

  const inner = (
    <div className={`flex items-start gap-3 rounded border p-3 transition hover:shadow-sm ${toneClass}`}>
      <Icon className="mt-1 h-4 w-4 shrink-0 text-gray-500" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
          {t(labelKey)}
        </p>
        <p className={`text-xl font-bold leading-tight ${valueClass}`}>{value}</p>
        {hint && <p className="truncate text-[11px] text-gray-500">{hint}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function PlatformOverviewPage() {
  const t = useTranslate();
  const locale = useLocale();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['platform', 'stats'],
    queryFn: () => platformApi.getStats(),
  });

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const s = stats as any;
  const statusBuckets: { status: string; count: number }[] = s.complaints?.byStatus ?? [];
  const totalComplaints = statusBuckets.reduce((sum, b) => sum + b.count, 0) || 1;
  const muniByCount: { municipalityId: string; municipalityName: string; count: number }[] =
    s.complaints?.byMunicipality ?? [];
  const recentMuni: any[] = s.recentMunicipalities ?? [];

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="border-b border-gray-200 pb-3">
        <h1 className="text-lg font-bold text-gray-900">{t('platform.title')}</h1>
        <p className="mt-0.5 text-xs text-gray-500">{t('platform.subtitle')}</p>
      </div>

      {/* ── Compact KPI strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile
          icon={Globe}
          labelKey="platform.kpi.municipalities.short"
          value={s.municipalities.total}
          hint={t('platform.stats.active').replace('{n}', String(s.municipalities.active))}
          href="/platform/municipalities"
        />
        <StatTile
          icon={Users}
          labelKey="platform.kpi.users.short"
          value={s.users.total}
          hint={t('platform.stats.active').replace('{n}', String(s.users.active))}
          href="/platform/users"
        />
        <StatTile
          icon={MessageSquareWarning}
          labelKey="platform.kpi.complaints.short"
          value={s.complaints.total}
          hint={`${t('platform.stats.resolutionRate')}: ${s.complaints.resolutionRate ?? 0}%`}
        />
        <StatTile
          icon={AlertTriangle}
          labelKey="platform.kpi.overdue.short"
          value={s.complaints.overdue ?? 0}
          tone={(s.complaints.overdue ?? 0) > 0 ? 'alert' : 'neutral'}
          hint={t('dashboard.alert.requiresAction')}
        />
        <StatTile
          icon={ShieldCheck}
          labelKey="platform.kpi.kyc.short"
          value={s.kyc.pending}
          tone={s.kyc.pending > 0 ? 'alert' : 'neutral'}
          hint={t('kyc.status.PENDING')}
        />
        <StatTile
          icon={CheckCircle2}
          labelKey="platform.kpi.resolution.short"
          value={`${s.complaints.resolutionRate ?? 0}%`}
          tone="success"
        />
      </div>

      {/* ── Status distribution as horizontal bars (no chart lib) ─────── */}
      <div className="gov-card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-gray-900">{t('platform.distribution.title')}</p>
            <p className="text-[11px] text-gray-500">{t('platform.distribution.subtitle')}</p>
          </div>
          <Activity className="h-4 w-4 text-gray-400" />
        </div>
        {statusBuckets.length > 0 ? (
          <ul className="space-y-2">
            {statusBuckets
              .sort((a, b) => b.count - a.count)
              .map((bucket) => {
                const pct = Math.round((bucket.count / totalComplaints) * 100);
                return (
                  <li key={bucket.status} className="flex items-center gap-3">
                    <span className={`inline-block w-32 shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_PILL[bucket.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {t(complaintStatusKey(bucket.status))}
                    </span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded bg-gray-100">
                      <span
                        className="absolute inset-y-0 start-0 bg-brand-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-end text-xs font-medium tabular-nums text-gray-700">
                      {bucket.count}
                    </span>
                    <span className="w-10 text-end text-[11px] tabular-nums text-gray-400">
                      {pct}%
                    </span>
                  </li>
                );
              })}
          </ul>
        ) : (
          <p className="py-6 text-center text-xs text-gray-400">{t('common.noData')}</p>
        )}
      </div>

      {/* ── 2-column: Municipality status + Workload ───────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="gov-card p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">{t('platform.section.muniStatus')}</p>
            <Link
              href="/platform/municipalities"
              className="flex items-center gap-1 text-[11px] font-medium text-brand-700 hover:underline"
            >
              {t('common.viewAll')}
              <ChevronRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="gov-table w-full text-sm">
              <thead>
                <tr>
                  <th>{t('platform.muniTable.col.name')}</th>
                  <th>{t('platform.muniTable.col.code')}</th>
                  <th>{t('platform.muniTable.col.status')}</th>
                  <th className="text-end">{t('platform.muniTable.col.users')}</th>
                  <th className="text-end">{t('platform.muniTable.col.complaints')}</th>
                  <th>{t('platform.muniTable.col.admin')}</th>
                  <th className="text-end"></th>
                </tr>
              </thead>
              <tbody>
                {recentMuni.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs text-gray-400">
                      {t('common.noData')}
                    </td>
                  </tr>
                )}
                {recentMuni.map((m: any) => {
                  const adminName = m.admin
                    ? `${m.admin.firstName} ${m.admin.lastName}`.trim()
                    : null;
                  const muniName = pickName(m, locale) || m.name;
                  return (
                    <tr key={m.id}>
                      <td className="font-medium text-gray-900">
                        <span className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-gray-400" />
                          {muniName}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-gray-500">{m.code}</td>
                      <td>
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${
                            m.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {m.isActive ? t('common.active') : t('common.inactive')}
                        </span>
                      </td>
                      <td className="text-end tabular-nums text-gray-700">
                        {m._count?.users ?? '—'}
                      </td>
                      <td className="text-end tabular-nums text-gray-700">
                        {m._count?.complaints ?? '—'}
                      </td>
                      <td className="text-xs text-gray-600">
                        {adminName ?? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                            {t('platform.muniTable.noAdmin')}
                          </span>
                        )}
                      </td>
                      <td className="text-end">
                        <Link
                          href={`/platform/municipalities`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                        >
                          <Eye className="h-3 w-3" />
                          {t('platform.muniTable.viewDetails')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Workload by municipality (simple bars) */}
        <div className="gov-card p-4">
          <p className="mb-3 text-sm font-bold text-gray-900">{t('platform.section.muniWorkload')}</p>
          {muniByCount.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400">{t('common.noData')}</p>
          ) : (
            <ul className="space-y-2">
              {muniByCount.slice(0, 8).map((row) => {
                const max = Math.max(...muniByCount.map((r) => r.count), 1);
                const pct = Math.round((row.count / max) * 100);
                return (
                  <li key={row.municipalityId}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium text-gray-700">
                        {row.municipalityName}
                      </span>
                      <span className="tabular-nums text-gray-500">{row.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-gray-100">
                      <span
                        className="block h-full bg-navy-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Quick links to ops areas ──────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Link
          href="/platform/audit"
          className="flex items-center gap-2 rounded border border-gray-200 bg-white p-3 hover:border-brand-300 hover:bg-brand-50"
        >
          <ScrollText className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-medium text-gray-800">{t('nav.platformAudit')}</span>
        </Link>
        <Link
          href="/platform/users"
          className="flex items-center gap-2 rounded border border-gray-200 bg-white p-3 hover:border-brand-300 hover:bg-brand-50"
        >
          <Users className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-medium text-gray-800">{t('nav.allUsers')}</span>
        </Link>
        <Link
          href="/platform/branding"
          className="flex items-center gap-2 rounded border border-gray-200 bg-white p-3 hover:border-brand-300 hover:bg-brand-50"
        >
          <Paintbrush className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-medium text-gray-800">{t('nav.platformBranding')}</span>
        </Link>
        <Link
          href="/platform/maintenance"
          className="flex items-center gap-2 rounded border border-gray-200 bg-white p-3 hover:border-brand-300 hover:bg-brand-50"
        >
          <Wrench className="h-4 w-4 text-brand-600" />
          <span className="text-sm font-medium text-gray-800">{t('nav.maintenance')}</span>
        </Link>
      </div>
    </div>
  );
}
