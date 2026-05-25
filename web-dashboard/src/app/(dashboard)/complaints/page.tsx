'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { complaintsApi, categoriesApi, departmentsApi } from '@/lib/api';
import { StatusBadge } from '@/components/features/complaints/status-badge';
import { PriorityBadge } from '@/components/features/complaints/priority-badge';
import { UnverifiedSubmitterBadge } from '@/components/features/complaints/unverified-submitter-badge';
import type { ComplaintRiskReason } from '@shared/types/complaint';
import { ComplaintStatus, ComplaintPriority } from '@shared/types/complaint';
import type { ComplaintBucketId } from '@shared/types/complaint';
import { formatDate } from '@/lib/utils';
import { useTranslate, useLocale } from '@/lib/i18n';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';
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
  CheckCircle2,
  Ban,
  Archive,
  History,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { PERMISSIONS } from '@shared/constants/permissions';
import { toast } from 'sonner';
import type { MessageKey } from '@/lib/i18n';

const PAGE_SIZE_OPTIONS = [15, 25, 50] as const;

interface BucketDef {
  id: ComplaintBucketId;
  labelKey: MessageKey;
  descKey: MessageKey;
  emptyKey: MessageKey;
  icon: React.ReactNode;
  visibleWhen: (perms: string[]) => boolean;
  isHistory?: boolean;
  /** Operational tab — active complaints only; status filter hidden. */
  isActiveOperational?: boolean;
}

const ALL_BUCKETS: BucketDef[] = [
  {
    id: 'needsAttention',
    labelKey: 'complaints.bucket.needsAttention',
    descKey: 'complaints.bucket.needsAttention.desc',
    emptyKey: 'complaints.empty.needsAttention',
    icon: <Inbox className="h-3.5 w-3.5" />,
    visibleWhen: (p) =>
      p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    isActiveOperational: true,
  },
  {
    id: 'assignedToMe',
    labelKey: 'complaints.bucket.assignedToMe',
    descKey: 'complaints.bucket.assignedToMe.desc',
    emptyKey: 'complaints.empty.assignedToMe',
    icon: <UserCheck className="h-3.5 w-3.5" />,
    visibleWhen: (p) =>
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    isActiveOperational: true,
  },
  {
    id: 'myDepartment',
    labelKey: 'complaints.bucket.myDepartment',
    descKey: 'complaints.bucket.myDepartmentActive.desc',
    emptyKey: 'complaints.empty.myDepartment',
    icon: <Building className="h-3.5 w-3.5" />,
    visibleWhen: (p) => p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT),
    isActiveOperational: true,
  },
  {
    id: 'all',
    labelKey: 'complaints.bucket.allActive',
    descKey: 'complaints.bucket.allActive.desc',
    emptyKey: 'complaints.empty.allActive',
    icon: <Globe className="h-3.5 w-3.5" />,
    visibleWhen: (p) => p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    isActiveOperational: true,
  },
  {
    id: 'overdue',
    labelKey: 'complaints.bucket.overdue',
    descKey: 'complaints.bucket.overdue.desc',
    emptyKey: 'complaints.empty.overdue',
    icon: <Clock className="h-3.5 w-3.5" />,
    visibleWhen: (p) =>
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    isActiveOperational: true,
  },
  {
    id: 'myReports',
    labelKey: 'complaints.bucket.myReports',
    descKey: 'complaints.bucket.myReports.desc',
    emptyKey: 'complaints.empty.myReports',
    icon: <FileText className="h-3.5 w-3.5" />,
    visibleWhen: (p) => p.includes(PERMISSIONS.COMPLAINT_VIEW_OWN),
  },
  {
    id: 'completed',
    labelKey: 'complaints.bucket.completed',
    descKey: 'complaints.bucket.completed.desc',
    emptyKey: 'complaints.empty.completed',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    visibleWhen: (p) =>
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    isHistory: true,
  },
  {
    id: 'rejected',
    labelKey: 'complaints.bucket.rejected',
    descKey: 'complaints.bucket.rejected.desc',
    emptyKey: 'complaints.empty.rejected',
    icon: <Ban className="h-3.5 w-3.5" />,
    visibleWhen: (p) =>
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    isHistory: true,
  },
  {
    id: 'closed',
    labelKey: 'complaints.bucket.closed',
    descKey: 'complaints.bucket.closed.desc',
    emptyKey: 'complaints.empty.closed',
    icon: <Archive className="h-3.5 w-3.5" />,
    visibleWhen: (p) =>
      p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    isHistory: true,
  },
  {
    id: 'history',
    labelKey: 'complaints.bucket.history',
    descKey: 'complaints.bucket.history.desc',
    emptyKey: 'complaints.empty.history',
    icon: <History className="h-3.5 w-3.5" />,
    visibleWhen: (p) =>
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
      p.includes(PERMISSIONS.COMPLAINT_VIEW_ALL),
    isHistory: true,
  },
];

function pickDefaultBucket(perms: string[]): ComplaintBucketId {
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

function parseBucketFromUrl(
  raw: string | null,
  visible: BucketDef[],
  perms: string[],
): ComplaintBucketId {
  if (raw && visible.some((b) => b.id === raw)) return raw as ComplaintBucketId;
  return visible[0]?.id ?? pickDefaultBucket(perms);
}

export default function ComplaintsPage() {
  const { user } = useAuth();
  const t = useTranslate();
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const perms = user?.permissions ?? [];
  const isStaffView =
    perms.includes(PERMISSIONS.COMPLAINT_VIEW_ALL) ||
    perms.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT) ||
    perms.includes(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED);

  const visibleBuckets = useMemo(
    () => ALL_BUCKETS.filter((b) => b.visibleWhen(perms)),
    [perms],
  );

  const [bucketId, setBucketId] = useState<ComplaintBucketId>(() =>
    parseBucketFromUrl(searchParams.get('bucket'), visibleBuckets, perms),
  );
  const [page, setPage] = useState(() =>
    Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1),
  );
  const [limit, setLimit] = useState(() => {
    const n = parseInt(searchParams.get('limit') ?? '15', 10);
    return PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number]) ? n : 15;
  });
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | ''>(
    (searchParams.get('status') as ComplaintStatus) || '',
  );
  const [priorityFilter, setPriorityFilter] = useState<ComplaintPriority | ''>(
    (searchParams.get('priority') as ComplaintPriority) || '',
  );
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('categoryId') ?? '');
  const [departmentFilter, setDepartmentFilter] = useState(searchParams.get('departmentId') ?? '');
  const [riskyOnly, setRiskyOnly] = useState(searchParams.get('riskyOnly') === 'true');

  const debouncedSearch = useDebouncedValue(search, 300);
  const activeBucket = visibleBuckets.find((b) => b.id === bucketId) ?? visibleBuckets[0];
  const isActiveOperational = activeBucket?.isActiveOperational ?? false;
  const isHistoryBucket = activeBucket?.isHistory ?? false;

  const syncUrl = useCallback(
    (patch: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([k, v]) => {
        if (v === undefined || v === '') params.delete(k);
        else params.set(k, v);
      });
      if (!params.get('bucket')) params.set('bucket', bucketId);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [bucketId, pathname, router, searchParams],
  );

  useEffect(() => {
    if (searchParams.get('overdue') === 'true' && !searchParams.get('bucket')) {
      switchBucket('overdue');
      return;
    }
    const urlBucket = parseBucketFromUrl(searchParams.get('bucket'), visibleBuckets, perms);
    if (urlBucket !== bucketId) setBucketId(urlBucket);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from URL only
  }, [searchParams, visibleBuckets, bucketId]);

  const listParams = useMemo(() => {
    const p: Record<string, unknown> = {
      page,
      limit,
      bucket: activeBucket?.id,
      search: debouncedSearch || undefined,
      priority: priorityFilter ? [priorityFilter] : undefined,
      categoryId: categoryFilter || undefined,
      departmentId: departmentFilter || undefined,
      riskyOnly: riskyOnly || undefined,
    };
    if (!isActiveOperational && statusFilter) {
      p.status = [statusFilter];
    }
    return p;
  }, [
    page,
    limit,
    activeBucket?.id,
    debouncedSearch,
    priorityFilter,
    categoryFilter,
    departmentFilter,
    riskyOnly,
    isActiveOperational,
    statusFilter,
  ]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['complaints', 'list', listParams],
    queryFn: () => complaintsApi.list(listParams as any),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  });

  const { data: buckets } = useQuery({
    queryKey: ['complaints', 'buckets'],
    queryFn: () => complaintsApi.getBuckets(),
    staleTime: 120_000,
    refetchOnWindowFocus: true,
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

  const switchBucket = (next: ComplaintBucketId) => {
    setBucketId(next);
    setPage(1);
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setDepartmentFilter('');
    setRiskyOnly(false);
    syncUrl({
      bucket: next,
      page: '1',
      status: undefined,
      priority: undefined,
      categoryId: undefined,
      departmentId: undefined,
      riskyOnly: undefined,
    });
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setCategoryFilter('');
    setDepartmentFilter('');
    setRiskyOnly(false);
    setPage(1);
    syncUrl({
      search: undefined,
      status: undefined,
      priority: undefined,
      categoryId: undefined,
      departmentId: undefined,
      riskyOnly: undefined,
      page: '1',
    });
  };

  const hasFilters =
    search || (!isActiveOperational && statusFilter) || priorityFilter || categoryFilter || departmentFilter || riskyOnly;

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

  const handleExport = async () => {
    const total = data?.meta?.total ?? 0;
    if (total === 0) return;
    if (total > 1000) {
      const ok = window.confirm(t('complaints.export.warningLarge', { count: String(total) }));
      if (!ok) return;
    }
    try {
      await complaintsApi.exportCsv(listParams as any);
      toast.success(t('complaints.exportStarted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('complaints.exportFailed'));
    }
  };

  const emptyMessage = activeBucket ? t(activeBucket.emptyKey) : t('complaints.empty');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isStaffView ? t('complaints.title.staff') : t('complaints.myReports')}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {isStaffView ? t('complaints.subtitle.staff') : t('complaints.subtitle.citizen')}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isStaffView && (
            <>
              <button
                type="button"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['complaints'] });
                  refetch();
                }}
                className="btn-gov-secondary"
                title={t('common.refresh')}
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={!data || (data.meta?.total ?? 0) === 0}
                className="btn-gov-secondary"
              >
                <Download className="h-4 w-4" />
                {t('complaints.exportCsv')}
              </button>
            </>
          )}
          <Link href="/complaints/new" className="btn-gov-primary">
            <Plus className="h-4 w-4" />
            {isStaffView ? t('complaints.createOnBehalf') : t('complaints.submit')}
          </Link>
        </div>
      </div>

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
                      ? b.isHistory
                        ? 'bg-gray-700 text-white'
                        : 'bg-brand-700 text-white'
                      : b.isHistory
                        ? 'text-gray-500 hover:bg-gray-100'
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
            <p className="px-3 py-2 text-xs text-gray-500">{t(activeBucket.descKey)}</p>
          )}
        </div>
      )}

      <div className="gov-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                syncUrl({ search: e.target.value || undefined, page: '1' });
              }}
              placeholder={t('complaints.search.placeholder')}
              className="input-gov ps-9"
            />
          </div>

          {!isActiveOperational && !isHistoryBucket && (
            <select
              value={statusFilter}
              onChange={(e) => {
                const v = e.target.value as ComplaintStatus | '';
                setStatusFilter(v);
                setPage(1);
                syncUrl({ status: v || undefined, page: '1' });
              }}
              className="select-gov"
            >
              <option value="">{t('complaints.filter.allStatuses')}</option>
              {Object.values(ComplaintStatus).map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          )}

          {isHistoryBucket && (
            <select
              value={statusFilter}
              onChange={(e) => {
                const v = e.target.value as ComplaintStatus | '';
                setStatusFilter(v);
                setPage(1);
                syncUrl({ status: v || undefined, page: '1' });
              }}
              className="select-gov"
            >
              <option value="">{t('complaints.filter.allStatuses')}</option>
              {[ComplaintStatus.COMPLETED, ComplaintStatus.REJECTED, ComplaintStatus.CLOSED].map((s) => (
                <option key={s} value={s}>{statusLabels[s]}</option>
              ))}
            </select>
          )}

          <select
            value={priorityFilter}
            onChange={(e) => {
              const v = e.target.value as ComplaintPriority | '';
              setPriorityFilter(v);
              setPage(1);
              syncUrl({ priority: v || undefined, page: '1' });
            }}
            className="select-gov"
          >
            <option value="">{t('complaints.filter.allPriorities')}</option>
            {Object.values(ComplaintPriority).map((p) => (
              <option key={p} value={p}>{t(`priority.${p}` as MessageKey)}</option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
              syncUrl({ categoryId: e.target.value || undefined, page: '1' });
            }}
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
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
                syncUrl({ departmentId: e.target.value || undefined, page: '1' });
              }}
              className="select-gov"
            >
              <option value="">{t('complaints.filter.allDepartments')}</option>
              {(departments as { id: string; name: string }[] || []).map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          <select
            value={String(limit)}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setLimit(n);
              setPage(1);
              syncUrl({ limit: String(n), page: '1' });
            }}
            className="select-gov w-24"
            aria-label={t('complaints.pageSize')}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>

          {isStaffView && (
            <label className="flex items-center gap-2 rounded border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={riskyOnly}
                onChange={(e) => {
                  setRiskyOnly(e.target.checked);
                  setPage(1);
                  syncUrl({ riskyOnly: e.target.checked ? 'true' : undefined, page: '1' });
                }}
                className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600"
              />
              {t('complaints.filter.riskyOnly')}
            </label>
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
              {isLoading && !data ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-400" />
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-sm text-gray-500">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data?.items.map((c: any) => (
                  <tr key={c.id} className={c.isOverdue ? 'row-overdue' : ''}>
                    <td className="font-mono text-xs text-gray-500 whitespace-nowrap">
                      {c.referenceCode || '—'}
                    </td>
                    <td className="max-w-[200px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {c.isOverdue && (
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-alert-600" />
                        )}
                        {c.isRiskySubmission && isStaffView && (
                          <UnverifiedSubmitterBadge
                            riskReasons={c.riskReasons as ComplaintRiskReason[] | undefined}
                          />
                        )}
                        <span className="truncate font-medium text-gray-900 block">{c.title}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell text-gray-600">{c.category?.name || '—'}</td>
                    <td className="hidden sm:table-cell">
                      <PriorityBadge priority={c.priority} />
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="hidden lg:table-cell text-gray-500 whitespace-nowrap">
                      {c.dueDate ? (
                        <span className={c.isOverdue ? 'font-semibold text-alert-600' : ''}>
                          {formatDate(c.dueDate)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="hidden md:table-cell text-gray-500 whitespace-nowrap">
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

        {data && (data.meta?.total ?? 0) > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-2.5">
            <p className="text-xs text-gray-500">
              {t('complaints.pagination', {
                from: String((page - 1) * limit + 1),
                to: String(Math.min(page * limit, data.meta.total)),
                total: String(data.meta.total),
              })}
            </p>
            {data.meta.totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const next = Math.max(1, page - 1);
                    setPage(next);
                    syncUrl({ page: String(next) });
                  }}
                  disabled={!data.meta.hasPrevPage}
                  className="pagination-btn"
                >
                  <ChevronLeft className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                </button>
                <span className="text-xs text-gray-700">
                  {data.meta.page} / {data.meta.totalPages}
                </span>
                <button
                  onClick={() => {
                    const next = page + 1;
                    setPage(next);
                    syncUrl({ page: String(next) });
                  }}
                  disabled={!data.meta.hasNextPage}
                  className="pagination-btn"
                >
                  <ChevronRight className={`h-3.5 w-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
