'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { complaintsApi, categoriesApi, departmentsApi } from '@/lib/api';
import { StatusBadge } from '@/components/features/complaints/status-badge';
import { PriorityBadge } from '@/components/features/complaints/priority-badge';
import { ComplaintStatus, ComplaintPriority } from '@shared/types/complaint';
import { formatDate } from '@/lib/utils';
import { useTranslate, useLocale } from '@/lib/i18n';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  X,
  AlertTriangle,
  Inbox,
  UserCheck,
  Building,
  Globe,
  Clock,
  FileText,
  Download,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { PERMISSIONS } from '@shared/constants/permissions';
import { toast } from 'sonner';
import type { MessageKey } from '@/lib/i18n';

type BucketId =
  | 'needsAttention'
  | 'assignedToMe'
  | 'myDepartment'
  | 'all'
  | 'overdue'
  | 'myReports';

interface BucketDef {
  id: BucketId;
  labelKey: MessageKey;
  descKey: MessageKey;
  icon: React.ReactNode;
  visibleWhen: (perms: string[]) => boolean;
  queryParams: () => {
    myAssignments?: boolean;
    unassigned?: boolean;
    overdue?: boolean;
  };
  openOnly?: boolean;
}

const ALL_BUCKETS: BucketDef[] = [
  {
    id: 'needsAttention',
    labelKey: 'complaints.bucket.needsAttention',
    descKey: 'complaints.bucket.needsAttention.desc',
    icon: <Inbox className="h-3.5 w-3.5" />,
    visibleWhen: (p) =>
      p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    queryParams: () => ({ unassigned: true }),
    openOnly: true,
  },
  {
    id: 'assignedToMe',
    labelKey: 'complaints.bucket.assignedToMe',
    descKey: 'complaints.bucket.assignedToMe.desc',
    icon: <UserCheck className="h-3.5 w-3.5" />,
    visibleWhen: (p) =>
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    queryParams: () => ({ myAssignments: true }),
  },
  {
    id: 'myDepartment',
    labelKey: 'complaints.bucket.myDepartment',
    descKey: 'complaints.bucket.myDepartment.desc',
    icon: <Building className="h-3.5 w-3.5" />,
    visibleWhen: (p) => p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT),
    queryParams: () => ({}),
  },
  {
    id: 'all',
    labelKey: 'complaints.bucket.all',
    descKey: 'complaints.bucket.all.desc',
    icon: <Globe className="h-3.5 w-3.5" />,
    visibleWhen: (p) => p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    queryParams: () => ({}),
  },
  {
    id: 'overdue',
    labelKey: 'complaints.bucket.overdue',
    descKey: 'complaints.bucket.overdue.desc',
    icon: <Clock className="h-3.5 w-3.5" />,
    visibleWhen: (p) =>
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    queryParams: () => ({ overdue: true }),
    openOnly: true,
  },
  {
    id: 'myReports',
    labelKey: 'complaints.bucket.myReports',
    descKey: 'complaints.bucket.myReports.desc',
    icon: <FileText className="h-3.5 w-3.5" />,
    visibleWhen: (p) => p.includes(PERMISSIONS.COMPLAINT_VIEW_OWN),
    queryParams: () => ({}),
  },
];

function pickDefaultBucket(perms: string[]): BucketId {
  if (
    perms.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED) &&
    !perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) &&
    !perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)
  ) {
    return 'assignedToMe';
  }
  if (perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT)) return 'needsAttention';
  if (perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL)) return 'all';
  return 'myReports';
}

export default function ComplaintsPage() {
  const { user } = useAuth();
  const t = useTranslate();
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const perms = user?.permissions ?? [];
  const isStaffView =
    perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) ||
    perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
    perms.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED);

  const visibleBuckets = useMemo(
    () => ALL_BUCKETS.filter((b) => b.visibleWhen(perms)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [perms.join(',')],
  );

  const [bucketId, setBucketId] = useState<BucketId>(() => pickDefaultBucket(perms));
  const activeBucket = visibleBuckets.find((b) => b.id === bucketId) ?? visibleBuckets[0];

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<ComplaintPriority | ''>('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const limit = 15;

  const bucketParams = activeBucket?.queryParams() ?? {};
  const bucketOpenOnly = activeBucket?.openOnly ?? false;

  const { data, isLoading } = useQuery({
    queryKey: [
      'complaints',
      activeBucket?.id,
      page,
      search,
      statusFilter,
      priorityFilter,
      categoryFilter,
      departmentFilter,
    ],
    queryFn: () =>
      complaintsApi.list({
        page,
        limit,
        search: search || undefined,
        status: statusFilter ? [statusFilter] : undefined,
        priority: priorityFilter ? [priorityFilter] : undefined,
        categoryId: categoryFilter || undefined,
        departmentId: departmentFilter || undefined,
        ...bucketParams,
        ...(bucketOpenOnly && !statusFilter ? { openOnly: true } : {}),
      }),
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: buckets } = useQuery({
    queryKey: ['complaints', 'buckets'],
    queryFn: () => complaintsApi.getBuckets(),
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
    enabled: perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
  });

  const switchBucket = (next: BucketId) => {
    setBucketId(next);
    setPage(1);
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setDepartmentFilter('');
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setDepartmentFilter('');
    setPage(1);
  };

  const hasFilters = search || statusFilter || priorityFilter || categoryFilter || departmentFilter;

  // Status labels using i18n
  const statusLabels: Record<ComplaintStatus, string> = {
    [ComplaintStatus.SUBMITTED]: t('status.SUBMITTED'),
    [ComplaintStatus.UNDER_REVIEW]: t('status.UNDER_REVIEW'),
    [ComplaintStatus.ASSIGNED]: t('status.ASSIGNED'),
    [ComplaintStatus.IN_PROGRESS]: t('status.IN_PROGRESS'),
    [ComplaintStatus.PENDING_APPROVAL]: t('status.PENDING_APPROVAL'),
    [ComplaintStatus.COMPLETED]: t('status.COMPLETED'),
    [ComplaintStatus.REJECTED]: t('status.REJECTED'),
    [ComplaintStatus.CLOSED]: t('status.CLOSED'),
  };

  const priorityLabels: Record<ComplaintPriority, string> = {
    [ComplaintPriority.LOW]: t('priority.LOW'),
    [ComplaintPriority.MEDIUM]: t('priority.MEDIUM'),
    [ComplaintPriority.HIGH]: t('priority.HIGH'),
    [ComplaintPriority.URGENT]: t('priority.URGENT'),
  };

  return (
    <div className="space-y-4">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {/* Operations title for staff — makes clear this is the municipal
              operations queue, not a personal complaints page. Citizens see
              "My Reports". */}
          <h1 className="text-xl font-bold text-gray-900">
            {isStaffView ? t('complaints.title.staff') : t('complaints.myReports')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isStaffView
              ? t('complaints.subtitle.staff')
              : t('complaints.subtitle.citizen')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isStaffView && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await complaintsApi.exportCsv({
                    search: search || undefined,
                    status: statusFilter ? [statusFilter] : undefined,
                    priority: priorityFilter ? [priorityFilter] : undefined,
                    categoryId: categoryFilter || undefined,
                    departmentId: departmentFilter || undefined,
                    ...bucketParams,
                    ...(bucketOpenOnly && !statusFilter ? { openOnly: true } : {}),
                  });
                  toast.success(t('complaints.exportStarted'));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : t('complaints.exportFailed'));
                }
              }}
              disabled={!data || data.items.length === 0}
              className="btn-gov-secondary"
            >
              <Download className="h-4 w-4" />
              {t('complaints.exportCsv')}
            </button>
          )}
          {/* For staff/admins the button is "Create on behalf of citizen" so it
              never reads like the admin is filing a personal complaint. For
              citizens it's "Submit a Report". */}
          <Link
            href="/complaints/new"
            className="btn-gov-primary"
          >
            <Plus className="h-4 w-4" />
            {isStaffView
              ? t('complaints.createOnBehalf')
              : t('complaints.submit')}
          </Link>
        </div>
      </div>

      {/* ── Bucket Tabs ───────────────────────────────────────────── */}
      {visibleBuckets.length > 1 && (
        <div className="gov-card overflow-hidden">
          <div className="flex flex-wrap gap-0.5 border-b border-gray-100 p-1.5">
            {visibleBuckets.map((b) => {
              const count = buckets?.[b.id] ?? 0;
              const isActive = activeBucket?.id === b.id;
              const isAlertBucket = b.id === 'overdue' || b.id === 'needsAttention';
              return (
                <button
                  key={b.id}
                  onClick={() => switchBucket(b.id)}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-brand-700 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {b.icon}
                  <span>{t(b.labelKey)}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : count > 0 && isAlertBucket
                        ? 'bg-alert-100 text-alert-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {activeBucket && (
            <p className="px-3 py-2 text-xs text-gray-500">
              {t(activeBucket.descKey)}
            </p>
          )}
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div className="gov-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('complaints.search.placeholder')}
              className="input-gov ps-9"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as ComplaintStatus | ''); setPage(1); }}
            className="select-gov"
          >
            <option value="">{t('complaints.filter.allStatuses')}</option>
            {Object.values(ComplaintStatus).map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value as ComplaintPriority | ''); setPage(1); }}
            className="select-gov"
          >
            <option value="">{t('complaints.filter.allPriorities')}</option>
            {Object.values(ComplaintPriority).map((p) => (
              <option key={p} value={p}>{priorityLabels[p]}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="select-gov"
          >
            <option value="">{t('complaints.filter.allCategories')}</option>
            {(categories as { id: string; name: string }[] || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) && (
            <select
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
              className="select-gov"
            >
              <option value="">{t('complaints.filter.allDepartments')}</option>
              {(departments as { id: string; name: string }[] || []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded px-2 py-2 text-xs text-gray-500 hover:bg-gray-100"
            >
              <X className="h-3.5 w-3.5" />
              {t('complaints.filter.clear')}
            </button>
          )}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────── */}
      <div className="gov-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gov-table responsive-table">
            <thead>
              <tr>
                <th>{t('complaints.col.reference')}</th>
                <th>{t('complaints.col.title')}</th>
                <th className="hidden md:table-cell">{t('complaints.col.category')}</th>
                <th className="hidden sm:table-cell">{t('complaints.col.priority')}</th>
                <th>{t('complaints.col.status')}</th>
                <th className="hidden lg:table-cell">{t('complaints.col.dueDate')}</th>
                <th className="hidden md:table-cell">{t('complaints.col.date')}</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-gray-500">
                    {t('complaints.empty')}
                  </td>
                </tr>
              ) : (
                data?.items.map((c: any) => (
                  <tr key={c.id} className={c.isOverdue ? 'row-overdue' : ''}>
                    <td
                      data-label={t('complaints.col.reference')}
                      className="font-mono text-xs text-gray-500 whitespace-nowrap"
                    >
                      {c.referenceCode || '—'}
                    </td>
                    <td
                      data-label={t('complaints.col.title')}
                      className="max-w-[200px]"
                    >
                      <div className="flex items-center gap-1.5">
                        {c.isOverdue && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-alert-600" />
                        )}
                        <span className="truncate font-medium text-gray-900 block">{c.title}</span>
                      </div>
                    </td>
                    <td
                      data-label={t('complaints.col.category')}
                      className="hidden md:table-cell text-gray-600"
                    >
                      {c.category?.name || '—'}
                    </td>
                    <td
                      data-label={t('complaints.col.priority')}
                      className="hidden sm:table-cell"
                    >
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td data-label={t('complaints.col.status')}>
                      <StatusBadge status={c.status} />
                    </td>
                    <td
                      data-label={t('complaints.col.dueDate')}
                      className="hidden lg:table-cell text-gray-500 whitespace-nowrap"
                    >
                      {c.dueDate ? (
                        <span className={c.isOverdue ? 'font-semibold text-alert-600' : ''}>
                          {formatDate(c.dueDate)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td
                      data-label={t('complaints.col.date')}
                      className="hidden md:table-cell text-gray-500 whitespace-nowrap"
                    >
                      {formatDate(c.createdAt)}
                    </td>
                    <td>
                      <Link
                        href={`/complaints/${c.id}`}
                        className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-800"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        {t('common.view')}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-2.5">
            <p className="text-xs text-gray-500">
              {t('complaints.pagination', {
                from: String((page - 1) * limit + 1),
                to: String(Math.min(page * limit, data.meta.total)),
                total: String(data.meta.total),
              })}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!data.meta.hasPrevPage}
                className="pagination-btn"
              >
                <ChevronLeft className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
              <span className="text-xs text-gray-700">
                {data.meta.page} / {data.meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.meta.hasNextPage}
                className="pagination-btn"
              >
                <ChevronRight className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
