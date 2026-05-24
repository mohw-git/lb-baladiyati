'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { complaintsApi, departmentsApi } from '@/lib/api';
import { useAuth, usePermission } from '@/lib/auth';
import { useTranslate, useLocale } from '@/lib/i18n';
import { PERMISSIONS } from '@shared/constants/permissions';
import { StatusBadge } from '@/components/features/complaints/status-badge';
import { PriorityBadge } from '@/components/features/complaints/priority-badge';
import { formatDate, formatRelative, getFullName } from '@/lib/utils';
import {
  MessageSquareWarning,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Users,
  Newspaper,
  Shield,
  Loader2,
  Timer,
  Clock,
  TrendingUp,
  FileText,
  AlertCircle,
  Building2,
  Inbox,
  ListChecks,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── SLA Status Tag ───────────────────────────────────────────────────────────
function SlaTag({ dueDate }: { dueDate?: string | null }) {
  const t = useTranslate();
  if (!dueDate) return <span className="text-gray-300 text-xs">—</span>;
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHrs = diffMs / 3_600_000;
  if (diffMs < 0)
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-alert-100 px-1.5 py-0.5 text-[10px] font-bold text-alert-800">
        <AlertTriangle className="h-2.5 w-2.5" />
        {t('dashboard.sla.breach')}
      </span>
    );
  if (diffHrs < 6)
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-warn-100 px-1.5 py-0.5 text-[10px] font-bold text-warn-800">
        <Clock className="h-2.5 w-2.5" />
        {t('dashboard.sla.atrisk')}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-success-100 px-1.5 py-0.5 text-[10px] font-medium text-success-800">
      {t('dashboard.sla.ok')}
    </span>
  );
}

// ─── Inline Stat Cell ─────────────────────────────────────────────────────────
function StatCell({
  label,
  value,
  valueClass = 'text-gray-900',
  highlight,
}: {
  label: string;
  value: number | string;
  valueClass?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-4 py-2 ${
        highlight ? 'bg-alert-50' : ''
      }`}
    >
      <span className={`text-lg font-bold leading-none ${valueClass}`}>{value}</span>
      <span className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
    </div>
  );
}

// ─── Compact Table Shell ──────────────────────────────────────────────────────
function SectionHeader({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2">
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600">
        {children}
      </span>
      {action && <span className="text-[11px] text-brand-600">{action}</span>}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const t = useTranslate();
  const locale = useLocale();
  const canViewComplaints = usePermission(PERMISSIONS.COMPLAINT_VIEW_ALL);
  const canViewDeptComplaints = usePermission(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT);
  const canViewAny = canViewComplaints || canViewDeptComplaints;
  const canManageUsers = usePermission(PERMISSIONS.USER_VIEW_ALL);
  const canManageNews = usePermission(PERMISSIONS.NEWS_CREATE);
  const canManageRoles = usePermission(PERMISSIONS.ROLE_VIEW);
  const isRtl = locale === 'ar';
  const municipalityName = (user as any)?.municipality?.name || '';

  // ── Data fetches ────────────────────────────────────────────────────────────
  const { data: statsData } = useQuery({
    queryKey: ['complaints', 'stats'],
    queryFn: () => complaintsApi.getStats(),
    enabled: canViewAny,
  });

  const { data: bucketsData } = useQuery({
    queryKey: ['complaints', 'buckets'],
    queryFn: () => complaintsApi.getBuckets(),
    enabled: canViewAny,
  });

  const { data: chartsData } = useQuery({
    queryKey: ['complaints', 'charts'],
    queryFn: () => complaintsApi.getCharts(),
    enabled: canViewAny,
  });

  // Main operational queue — 20 items, all open
  const { data: queueData, isLoading: queueLoading } = useQuery({
    queryKey: ['complaints', 'queue'],
    queryFn: () => complaintsApi.list({ page: 1, limit: 20, openOnly: true }),
    enabled: canViewAny,
    refetchInterval: 30_000,
  });

  // Overdue queue — separate, critical section
  const { data: overdueData, isLoading: overdueLoading } = useQuery({
    queryKey: ['complaints', 'overdue-queue'],
    queryFn: () => complaintsApi.list({ page: 1, limit: 8, overdue: true }),
    enabled: canViewAny,
    refetchInterval: 30_000,
  });

  // Departments for workload panel
  const { data: deptData } = useQuery({
    queryKey: ['departments', 'list'],
    queryFn: () => departmentsApi.list(),
    enabled: canViewAny,
  });

  // Citizen own complaints
  const { data: myComplaintsData, isLoading: myComplaintsLoading } = useQuery({
    queryKey: ['complaints', 'my', 'recent'],
    queryFn: () => complaintsApi.list({ page: 1, limit: 5 }),
    enabled: !canViewAny,
  });

  const stats = statsData as any;
  const buckets = bucketsData as any;
  const charts = chartsData as any;
  const overdueCount: number = stats?.overdue ?? 0;
  const underReviewCount: number =
    (stats?.byStatus?.UNDER_REVIEW ?? 0) + (stats?.byStatus?.IN_PROGRESS ?? 0);
  const pendingCount: number =
    (stats?.byStatus?.SUBMITTED ?? 0) +
    (stats?.byStatus?.UNDER_REVIEW ?? 0) +
    (stats?.byStatus?.ASSIGNED ?? 0);
  const resolvedCount: number =
    (stats?.byStatus?.COMPLETED ?? 0) + (stats?.byStatus?.CLOSED ?? 0);

  // ── CITIZEN VIEW ─────────────────────────────────────────────────────────────
  if (!canViewAny) {
    return (
      <div className="space-y-4">
        <div className="border-b border-gray-200 pb-3">
          <h1 className="text-lg font-bold text-gray-900">{t('dashboard.citizenView')}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('dashboard.citizenSubtitle')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/complaints/new" className="btn-gov-primary">
            <FileText className="h-4 w-4" />
            {t('complaints.submit')}
          </Link>
          <Link href="/complaints" className="btn-gov-secondary">
            {t('complaints.myReports')}
          </Link>
        </div>
        <div className="gov-card overflow-hidden">
          <SectionHeader>{t('dashboard.myRecentComplaints')}</SectionHeader>
          {myComplaintsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : (myComplaintsData?.items?.length ?? 0) === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500">{t('dashboard.myRecentComplaints.empty')}</p>
              <Link
                href="/complaints/new"
                className="mt-2 inline-block text-sm text-brand-600 hover:underline"
              >
                {t('dashboard.submitFirst')}
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {myComplaintsData?.items?.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/complaints/${c.id}`}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{c.title}</p>
                    <p className="text-xs text-gray-400">
                      {c.referenceCode} · {formatRelative(c.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} className="ms-3 shrink-0" />
                </Link>
              ))}
            </div>
          )}
          {(myComplaintsData?.items?.length ?? 0) > 0 && (
            <div className="border-t border-gray-100 px-4 py-2">
              <Link href="/complaints" className="text-xs text-brand-600 hover:underline">
                {t('common.viewAll')} →
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── STAFF / ADMIN OPERATIONAL CONSOLE ────────────────────────────────────────
  return (
    <div className="space-y-0 divide-y divide-gray-200">

      {/* ═══ CRITICAL ALERT BANNER (conditional) ═════════════════════════════ */}
      {overdueCount > 0 && (
        <div className="flex items-center justify-between bg-alert-700 px-4 py-2 text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {overdueCount} {t('dashboard.alert.overdueCount')}
              {' — '}{t('dashboard.alert.requiresAction')}
            </span>
          </div>
          <Link
            href="/complaints?overdue=true"
            className="flex items-center gap-1 rounded border border-alert-400 px-2.5 py-1 text-xs font-semibold hover:bg-alert-600"
          >
            {t('dashboard.alert.reviewNow')}
            <ArrowRight className={`h-3 w-3 ${isRtl ? 'rotate-180' : ''}`} />
          </Link>
        </div>
      )}

      {/* ═══ PAGE HEADER + STAT STRIP ════════════════════════════════════════ */}
      <div className="bg-white">
        {/* Title row */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h1 className="text-base font-bold text-gray-900">{t('dashboard.title')}</h1>
            <p className="text-[11px] text-gray-400">
              {municipalityName
                ? t('dashboard.subtitle', { municipality: municipalityName })
                : t('dashboard.subtitleGeneric')}
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Clock className="h-3 w-3" />
            {new Date().toLocaleDateString(locale === 'ar' ? 'ar-DZ' : locale === 'fr' ? 'fr-FR' : 'en-GB', {
              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
            })}
          </div>
        </div>

        {/* Compact stat strip — NOT cards, NOT equal boxes */}
        <div className="flex items-stretch divide-x divide-gray-100 overflow-x-auto">
          <StatCell label={t('dashboard.stats.totalComplaints')} value={stats?.total ?? '—'} />
          <StatCell
            label={t('dashboard.stats.pendingReview')}
            value={pendingCount}
            valueClass={pendingCount > 0 ? 'text-warn-700' : 'text-gray-900'}
          />
          <StatCell
            label={t('dashboard.stats.underReview')}
            value={underReviewCount}
            valueClass={underReviewCount > 0 ? 'text-brand-700' : 'text-gray-900'}
          />
          <StatCell
            label={t('dashboard.stats.overdue')}
            value={overdueCount}
            valueClass={overdueCount > 0 ? 'text-alert-700 font-extrabold' : 'text-gray-400'}
            highlight={overdueCount > 0}
          />
          <StatCell label={t('dashboard.stats.resolved')} value={resolvedCount} valueClass="text-success-700" />
          <StatCell
            label={t('dashboard.stats.avgResolution')}
            value={
              charts?.avgResolutionHours != null
                ? charts.avgResolutionHours > 24
                  ? `${Math.round(charts.avgResolutionHours / 24)}d`
                  : `${charts.avgResolutionHours}h`
                : '—'
            }
          />
          {buckets && (
            <StatCell
              label={t('dashboard.stats.needsAttention')}
              value={buckets.needsAttention ?? 0}
              valueClass={buckets.needsAttention > 0 ? 'text-alert-600' : 'text-gray-900'}
            />
          )}
        </div>
      </div>

      {/* ═══ MAIN OPERATIONAL GRID ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 gap-0 divide-y divide-gray-200 xl:grid-cols-3 xl:divide-x xl:divide-y-0">

        {/* ── LEFT: Open Complaint Queue (2/3) ──────────────────────────── */}
        <div className="xl:col-span-2">

          {/* Overdue sub-section if any */}
          {(overdueData?.items?.length ?? 0) > 0 && (
            <div className="border-b border-alert-200 bg-alert-50">
              <SectionHeader
                action={
                  <Link href="/complaints?overdue=true" className="flex items-center gap-0.5 text-alert-700 hover:underline">
                    {t('common.viewAll')} <ArrowRight className={`h-3 w-3 ${isRtl ? 'rotate-180' : ''}`} />
                  </Link>
                }
              >
                <span className="flex items-center gap-1.5 text-alert-700">
                  <AlertTriangle className="h-3 w-3" />
                  {t('dashboard.section.overdue')} ({overdueData?.items?.length ?? 0})
                </span>
              </SectionHeader>
              {overdueLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-alert-100">
                      {overdueData?.items?.map((c: any) => (
                        <tr key={c.id} className="hover:bg-alert-100/50">
                          <td className="w-24 whitespace-nowrap px-3 py-2 font-mono text-alert-600">
                            <Link href={`/complaints/${c.id}`} className="hover:underline">
                              {c.referenceCode || '—'}
                            </Link>
                          </td>
                          <td className="max-w-[200px] px-2 py-2">
                            <Link
                              href={`/complaints/${c.id}`}
                              className="block truncate font-semibold text-gray-900 hover:text-brand-700 hover:underline"
                            >
                              {c.title}
                            </Link>
                          </td>
                          <td className="hidden px-2 py-2 text-gray-500 sm:table-cell">
                            {c.category?.name || '—'}
                          </td>
                          <td className="hidden px-2 py-2 md:table-cell">
                            <PriorityBadge priority={c.priority} />
                          </td>
                          <td className="px-2 py-2">
                            <StatusBadge status={c.status} />
                          </td>
                          <td className="hidden whitespace-nowrap px-2 py-2 text-gray-400 lg:table-cell">
                            {formatDate(c.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Open complaint queue */}
          <SectionHeader
            action={
              <Link
                href="/complaints"
                className="flex items-center gap-0.5 hover:underline"
              >
                {t('common.viewAll')} <ArrowRight className={`h-3 w-3 ${isRtl ? 'rotate-180' : ''}`} />
              </Link>
            }
          >
            <span className="flex items-center gap-1.5">
              <Inbox className="h-3 w-3" />
              {t('dashboard.section.openQueue')}
              {queueData?.meta?.total != null && (
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
                  {queueData.meta.total}
                </span>
              )}
            </span>
          </SectionHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-gray-200 bg-gray-50/80">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
                    {t('dashboard.col.ref')}
                  </th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wide text-gray-500">
                    {t('dashboard.col.title')}
                  </th>
                  <th className="hidden px-2 py-2 font-semibold uppercase tracking-wide text-gray-500 sm:table-cell">
                    {t('dashboard.col.category')}
                  </th>
                  <th className="hidden px-2 py-2 font-semibold uppercase tracking-wide text-gray-500 md:table-cell">
                    {t('dashboard.col.dept')}
                  </th>
                  <th className="hidden px-2 py-2 font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">
                    {t('dashboard.col.priority')}
                  </th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wide text-gray-500">
                    {t('dashboard.col.sla')}
                  </th>
                  <th className="px-2 py-2 font-semibold uppercase tracking-wide text-gray-500">
                    {t('dashboard.col.status')}
                  </th>
                  <th className="hidden px-2 py-2 font-semibold uppercase tracking-wide text-gray-500 md:table-cell">
                    {t('dashboard.col.date')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {queueLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-300" />
                    </td>
                  </tr>
                ) : (queueData?.items?.length ?? 0) === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-gray-400">
                      {t('dashboard.recentComplaints.empty')}
                    </td>
                  </tr>
                ) : (
                  queueData?.items?.map((c: any) => (
                    <tr
                      key={c.id}
                      className={`hover:bg-gray-50 ${c.isOverdue ? 'bg-alert-50/40' : ''}`}
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-500">
                        <Link
                          href={`/complaints/${c.id}`}
                          className="hover:text-brand-600 hover:underline"
                        >
                          {c.referenceCode || '—'}
                        </Link>
                      </td>
                      <td className="max-w-[180px] px-2 py-2">
                        <div className="flex items-center gap-1">
                          {c.isOverdue && (
                            <AlertTriangle className="h-3 w-3 shrink-0 text-alert-500" />
                          )}
                          <Link
                            href={`/complaints/${c.id}`}
                            className="block truncate font-medium text-gray-900 hover:text-brand-700 hover:underline"
                          >
                            {c.title}
                          </Link>
                        </div>
                      </td>
                      <td className="hidden max-w-[100px] px-2 py-2 sm:table-cell">
                        <span className="truncate text-gray-500">{c.category?.name || '—'}</span>
                      </td>
                      <td className="hidden max-w-[110px] px-2 py-2 md:table-cell">
                        <span className="truncate text-gray-500">
                          {c.department?.name || (
                            <span className="italic text-gray-300">{t('common.unassigned')}</span>
                          )}
                        </span>
                      </td>
                      <td className="hidden px-2 py-2 lg:table-cell">
                        <PriorityBadge priority={c.priority} />
                      </td>
                      <td className="px-2 py-2">
                        <SlaTag dueDate={c.dueDate} />
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-2 text-gray-400 md:table-cell">
                        {formatDate(c.createdAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── RIGHT PANEL (1/3) ─────────────────────────────────────────── */}
        <div className="flex flex-col divide-y divide-gray-200">

          {/* Department Workload Table */}
          <div>
            <SectionHeader>
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3 w-3" />
                {t('dashboard.section.deptWorkload')}
              </span>
            </SectionHeader>
            {!deptData ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-gray-300" />
              </div>
            ) : deptData.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400">{t('common.noData')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-gray-200 bg-gray-50/80">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-semibold uppercase tracking-wide text-gray-500">
                        {t('common.department')}
                      </th>
                      <th className="px-2 py-2 text-center font-semibold uppercase tracking-wide text-gray-500">
                        {t('dashboard.col.complaints')}
                      </th>
                      <th className="px-2 py-2 text-center font-semibold uppercase tracking-wide text-gray-500">
                        {t('dashboard.col.staff')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {deptData
                      .slice()
                      .sort(
                        (a, b) =>
                          (b._count?.complaints ?? 0) - (a._count?.complaints ?? 0),
                      )
                      .map((dept) => (
                        <tr key={dept.id} className="hover:bg-gray-50">
                          <td className="max-w-[130px] px-3 py-2">
                            <Link
                              href={`/departments/${dept.id}`}
                              className="truncate block font-medium text-gray-800 hover:text-brand-700 hover:underline"
                            >
                              {dept.name}
                            </Link>
                            {dept.head && (
                              <span className="text-gray-400">
                                {getFullName(dept.head as any)}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={`font-bold ${
                                (dept._count?.complaints ?? 0) > 10
                                  ? 'text-alert-700'
                                  : (dept._count?.complaints ?? 0) > 5
                                  ? 'text-warn-700'
                                  : 'text-gray-700'
                              }`}
                            >
                              {dept._count?.complaints ?? 0}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-gray-500">
                            {dept._count?.users ?? 0}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Operational Quick Links */}
          <div>
            <SectionHeader>
              <span className="flex items-center gap-1.5">
                <ListChecks className="h-3 w-3" />
                {t('dashboard.section.actions')}
              </span>
            </SectionHeader>
            <div className="divide-y divide-gray-100">
              {canViewAny && (
                <>
                  <Link
                    href="/complaints"
                    className="flex items-center justify-between px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2">
                      <MessageSquareWarning className="h-3.5 w-3.5 text-gray-400" />
                      {t('complaints.title')}
                    </span>
                    {bucketsData && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                        {(bucketsData as any).all ?? 0}
                      </span>
                    )}
                  </Link>
                  <Link
                    href="/complaints?overdue=true"
                    className="flex items-center justify-between px-3 py-2.5 text-xs hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2 font-semibold text-alert-700">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {t('dashboard.nav.overdue')}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 font-bold ${
                        overdueCount > 0
                          ? 'bg-alert-100 text-alert-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {overdueCount}
                    </span>
                  </Link>
                  <Link
                    href="/tasks"
                    className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <ListChecks className="h-3.5 w-3.5 text-gray-400" />
                    {t('tasks.title')}
                  </Link>
                  <Link
                    href="/transfers"
                    className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                    {t('transfers.title')}
                  </Link>
                </>
              )}
              {canManageUsers && (
                <Link
                  href="/users"
                  className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Users className="h-3.5 w-3.5 text-gray-400" />
                  {t('users.title')}
                </Link>
              )}
              {canManageRoles && (
                <Link
                  href="/roles"
                  className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Shield className="h-3.5 w-3.5 text-gray-400" />
                  {t('roles.title')}
                </Link>
              )}
              {canManageNews && (
                <Link
                  href="/news"
                  className="flex items-center gap-2 px-3 py-2.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Newspaper className="h-3.5 w-3.5 text-gray-400" />
                  {t('news.title')}
                </Link>
              )}
            </div>
          </div>

          {/* Compact Status Breakdown (text, not pie) */}
          {stats?.byStatus && (
            <div>
              <SectionHeader>
                <span className="flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  {t('dashboard.section.statusBreakdown')}
                </span>
              </SectionHeader>
              <div className="divide-y divide-gray-100">
                {Object.entries(stats.byStatus as Record<string, number>)
                  .filter(([, v]) => v > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between px-3 py-1.5">
                      <span className="text-xs text-gray-600">{status.replace(/_/g, ' ')}</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-1 rounded-full bg-brand-600"
                          style={{
                            width: `${Math.max(4, Math.round((count / (stats.total || 1)) * 64))}px`,
                          }}
                        />
                        <span className="w-6 text-right text-xs font-semibold text-gray-700">
                          {count}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ SECONDARY ROW: Trend chart (small) ══════════════════════════════ */}
      <div className="grid grid-cols-1 gap-0 divide-y divide-gray-200 xl:grid-cols-3 xl:divide-x xl:divide-y-0">

        {/* Trend chart (2/3) — small height, operationally useful */}
        <div className="xl:col-span-2">
          <SectionHeader>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" />
              {t('dashboard.trendLast30')}
            </span>
          </SectionHeader>
          <div className="p-3">
            {(charts?.complaintsPerDay?.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart
                  data={charts.complaintsPerDay}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="gradNav" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1e4488" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1e4488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    tickFormatter={(v) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: '#9ca3af' }}
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 2,
                      border: '1px solid #e5e7eb',
                      padding: '4px 8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#1e4488"
                    fill="url(#gradNav)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[120px] items-center justify-center text-xs text-gray-400">
                {t('dashboard.noActivity')}
              </div>
            )}
          </div>
        </div>

        {/* Avg resolution + period summary (1/3) */}
        <div className="divide-y divide-gray-100">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-brand-50 text-brand-700">
              <Timer className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-400">
                {t('dashboard.stats.avgResolution')}
              </p>
              <p className="text-lg font-bold text-gray-900">
                {charts?.avgResolutionHours != null
                  ? charts.avgResolutionHours > 24
                    ? `${Math.round(charts.avgResolutionHours / 24)}d`
                    : `${charts.avgResolutionHours}h`
                  : '—'}
              </p>
            </div>
          </div>
          {stats?.byPriority && (
            <div>
              <div className="px-3 pb-1 pt-2">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">
                  {t('dashboard.byPriority')}
                </p>
              </div>
              {Object.entries(stats.byPriority as Record<string, number>)
                .filter(([, v]) => v > 0)
                .map(([priority, count]) => {
                  const cls =
                    priority === 'URGENT'
                      ? 'text-alert-700 font-bold'
                      : priority === 'HIGH'
                      ? 'text-warn-700 font-semibold'
                      : 'text-gray-600';
                  return (
                    <div key={priority} className="flex items-center justify-between px-3 py-1.5">
                      <span className={`text-xs ${cls}`}>{priority}</span>
                      <span className="text-xs font-semibold text-gray-700">{count}</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
