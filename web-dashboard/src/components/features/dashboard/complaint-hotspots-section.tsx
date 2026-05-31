'use client';



import { useMemo, useState } from 'react';

import dynamic from 'next/dynamic';

import { useQuery } from '@tanstack/react-query';

import { ChevronDown, Loader2, MapPin, RefreshCw } from 'lucide-react';

import { complaintsApi, categoriesApi } from '@/lib/api';

import { useAuth, usePermission } from '@/lib/auth';

import { pickName, useLocale, useTranslate } from '@/lib/i18n';

import { PERMISSIONS } from '@shared/constants/permissions';

import {

  ComplaintPriority,

  ComplaintStatus,

  type ComplaintMapPointsQueryParams,

} from '@shared/types/complaint';



/** Compact map height — operational content stays above the fold. */

export const COMPLAINT_MAP_HEIGHT_PX = 300;



function MapChunkLoader() {

  const t = useTranslate();

  return <MapPlaceholder message={t('dashboard.map.loadingMap')} />;

}



const ComplaintHotspotsMap = dynamic(() => import('./complaint-hotspots-map'), {

  ssr: false,

  loading: () => <MapChunkLoader />,

});



const MAP_FETCH_TIMEOUT_MS = 25_000;



const STATUS_OPTIONS: ComplaintStatus[] = [

  ComplaintStatus.SUBMITTED,

  ComplaintStatus.UNDER_REVIEW,

  ComplaintStatus.ASSIGNED,

  ComplaintStatus.IN_PROGRESS,

  ComplaintStatus.PENDING_APPROVAL,

  ComplaintStatus.COMPLETED,

  ComplaintStatus.REJECTED,

  ComplaintStatus.CLOSED,

];



const PRIORITY_OPTIONS: ComplaintPriority[] = [

  ComplaintPriority.LOW,

  ComplaintPriority.MEDIUM,

  ComplaintPriority.HIGH,

  ComplaintPriority.URGENT,

];



type MapViewMode = 'clusters' | 'heatmap' | 'department';



export function ComplaintHotspotsSection() {

  const t = useTranslate();

  const locale = useLocale();

  const { user, isLoading: authLoading } = useAuth();

  const canViewAllMap = usePermission(PERMISSIONS.COMPLAINT_VIEW_ALL);

  const canViewDeptMap = usePermission(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT);

  const canViewAssignedMap = usePermission(PERMISSIONS.COMPLAINT_VIEW_ASSIGNED);

  const canAccessMap = canViewAllMap || canViewDeptMap || canViewAssignedMap;

  const isDeptScopedMap = canViewDeptMap && !canViewAllMap;

  const isAssignedOnlyMap =

    canViewAssignedMap && !canViewAllMap && !canViewDeptMap;

  const [mapView, setMapView] = useState<MapViewMode>(

    isDeptScopedMap ? 'department' : 'clusters',

  );

  const [filtersOpen, setFiltersOpen] = useState(false);



  const [status, setStatus] = useState('');

  const [priority, setPriority] = useState('');

  const [categoryId, setCategoryId] = useState('');

  const [dateFrom, setDateFrom] = useState('');

  const [dateTo, setDateTo] = useState('');



  const queryParams = useMemo((): ComplaintMapPointsQueryParams => {

    const p: ComplaintMapPointsQueryParams = {};

    if (status) p.status = status as ComplaintStatus;

    if (priority) p.priority = priority as ComplaintPriority;

    if (categoryId) p.categoryId = categoryId;

    if (dateFrom) p.dateFrom = dateFrom;

    if (dateTo) p.dateTo = dateTo;

    return p;

  }, [status, priority, categoryId, dateFrom, dateTo]);



  const { data, isPending, isError, refetch, isFetching, failureReason } = useQuery({

    queryKey: ['complaints', 'map-points', queryParams],

    queryFn: async ({ signal }) => {

      const timeout = new AbortController();

      const timer = window.setTimeout(() => timeout.abort(), MAP_FETCH_TIMEOUT_MS);

      const onAbort = () => timeout.abort();

      signal?.addEventListener('abort', onAbort);

      try {

        return await complaintsApi.getMapPoints(queryParams, {

          signal: timeout.signal,

        });

      } finally {

        window.clearTimeout(timer);

        signal?.removeEventListener('abort', onAbort);

      }

    },

    enabled: !authLoading && !!user && canAccessMap,

    staleTime: 60_000,

    refetchOnWindowFocus: canAccessMap,

    retry: (failureCount, error) => {

      const status = (error as { status?: number })?.status;

      if (status === 401 || status === 403) return false;

      return failureCount < 1;

    },

  });



  const { data: categories } = useQuery({

    queryKey: ['categories'],

    queryFn: () => categoriesApi.list(),

  });



  const mapSubtitle = isAssignedOnlyMap

    ? t('dashboard.map.subtitleAssigned')

    : isDeptScopedMap

      ? t('dashboard.map.subtitleDepartment')

      : t('dashboard.map.subtitle');



  const mapSummaryKey = isAssignedOnlyMap

    ? 'dashboard.map.summaryAssigned'

    : isDeptScopedMap

      ? 'dashboard.map.summaryDepartment'

      : 'dashboard.map.summary';



  const hasFilters = Boolean(status || priority || categoryId || dateFrom || dateTo);



  const clearFilters = () => {

    setStatus('');

    setPriority('');

    setCategoryId('');

    setDateFrom('');

    setDateTo('');

  };



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



  const points = Array.isArray(data?.points) ? data.points : [];

  const pointCount = data?.total ?? points.length;

  const emptyMessageKey = isAssignedOnlyMap

    ? 'dashboard.map.emptyAssigned'

    : isDeptScopedMap

      ? 'dashboard.map.emptyDepartment'

      : 'dashboard.map.empty';

  const mapLoading = authLoading || isPending;

  if (!canAccessMap) {

    return null;

  }



  return (

    <section className="border-b border-gray-200 bg-gray-50/50 px-4 py-3">

      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">

        <div className="min-w-0 flex-1">

          <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">

            <MapPin className="h-4 w-4 shrink-0 text-brand-600" />

            {t('dashboard.map.title')}

          </h2>

          <p className="mt-0.5 text-xs text-gray-500">{mapSubtitle}</p>

          {!mapLoading && !isError && pointCount > 0 && (

            <p className="mt-1 text-xs font-medium text-brand-800">

              {t(mapSummaryKey, { count: String(pointCount) })}

            </p>

          )}

        </div>

        <button

          type="button"

          onClick={() => refetch()}

          disabled={isFetching}

          className="inline-flex shrink-0 items-center gap-1 rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"

          aria-label={t('common.refresh')}

        >

          <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />

          {t('common.refresh')}

        </button>

      </div>



      <div

        className="mb-2 flex flex-wrap items-center gap-1"

        role="tablist"

        aria-label={t('dashboard.map.viewModes')}

      >

        <MapViewTab

          active={mapView === 'clusters'}

          onClick={() => setMapView('clusters')}

          label={t('dashboard.map.view.clusters')}

          hidden={isDeptScopedMap}

        />

        <MapViewTab

          active={mapView === 'heatmap'}

          disabled

          label={t('dashboard.map.view.heatmap')}

          title={t('dashboard.map.view.comingSoon')}

          hidden={isDeptScopedMap || isAssignedOnlyMap}

        />

        <MapViewTab

          active={mapView === 'department'}

          onClick={() => setMapView('department')}

          label={t('dashboard.map.view.department')}

          hidden={!isDeptScopedMap}

        />

      </div>



      <div className="mb-2 rounded-lg border border-gray-200 bg-white">

        <button

          type="button"

          onClick={() => setFiltersOpen((o) => !o)}

          className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50"

          aria-expanded={filtersOpen}

        >

          <span>{t('dashboard.map.filtersToggle')}</span>

          <span className="flex items-center gap-2">

            {hasFilters && (

              <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold normal-case text-brand-800">

                {t('dashboard.map.filtersActive')}

              </span>

            )}

            <ChevronDown

              className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}

            />

          </span>

        </button>

        {filtersOpen && (

          <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 px-3 py-2">

            <FilterSelect

              label={t('dashboard.map.filter.status')}

              value={status}

              onChange={setStatus}

              options={[

                { value: '', label: t('dashboard.map.filter.all') },

                ...STATUS_OPTIONS.map((s) => ({ value: s, label: statusLabels[s] })),

              ]}

            />

            <FilterSelect

              label={t('dashboard.map.filter.category')}

              value={categoryId}

              onChange={setCategoryId}

              options={[

                { value: '', label: t('dashboard.map.filter.all') },

                ...(categories ?? []).map((c) => ({

                  value: c.id,

                  label: pickName(c, locale),

                })),

              ]}

            />

            <FilterSelect

              label={t('dashboard.map.filter.priority')}

              value={priority}

              onChange={setPriority}

              options={[

                { value: '', label: t('dashboard.map.filter.all') },

                ...PRIORITY_OPTIONS.map((p) => ({ value: p, label: priorityLabels[p] })),

              ]}

            />

            <div className="flex flex-col gap-0.5">

              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">

                {t('dashboard.map.filter.dateFrom')}

              </label>

              <input

                type="date"

                value={dateFrom}

                onChange={(e) => setDateFrom(e.target.value)}

                className="h-8 rounded border border-gray-200 px-2 text-xs text-gray-800"

              />

            </div>

            <div className="flex flex-col gap-0.5">

              <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">

                {t('dashboard.map.filter.dateTo')}

              </label>

              <input

                type="date"

                value={dateTo}

                onChange={(e) => setDateTo(e.target.value)}

                className="h-8 rounded border border-gray-200 px-2 text-xs text-gray-800"

              />

            </div>

            {hasFilters && (

              <button

                type="button"

                onClick={clearFilters}

                className="h-8 self-end px-2 text-xs font-medium text-brand-600 hover:underline"

              >

                {t('dashboard.map.filter.clear')}

              </button>

            )}

          </div>

        )}

      </div>



      {mapLoading ? (

        <MapPlaceholder message={t('dashboard.map.loading')} />

      ) : isError ? (

        <div

          className="flex flex-col items-center justify-center rounded-lg border border-alert-200 bg-alert-50 px-4 text-center"

          style={{ height: COMPLAINT_MAP_HEIGHT_PX }}

        >

          <p className="text-sm font-medium text-alert-800">{t('dashboard.map.error')}</p>

          {failureReason instanceof Error && failureReason.name === 'AbortError' && (

            <p className="mt-1 text-xs text-alert-700">{t('dashboard.map.errorTimeout')}</p>

          )}

          <button

            type="button"

            onClick={() => refetch()}

            className="mt-2 text-xs font-semibold text-brand-600 hover:underline"

          >

            {t('common.retry')}

          </button>

        </div>

      ) : points.length === 0 ? (

        <div

          className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-4 text-center"

          style={{ height: Math.min(COMPLAINT_MAP_HEIGHT_PX, 200) }}

        >

          <MapPin className="mb-2 h-7 w-7 text-gray-300" />

          <p className="text-sm text-gray-600">{t(emptyMessageKey)}</p>

        </div>

      ) : data ? (

        <ComplaintHotspotsMap data={{ ...data, points }} height={COMPLAINT_MAP_HEIGHT_PX} />

      ) : (

        <MapPlaceholder message={t('dashboard.map.loading')} />

      )}

    </section>

  );

}



function MapPlaceholder({ message }: { message?: string }) {

  return (

    <div

      className="flex items-center justify-center rounded-lg border border-gray-200 bg-white"

      style={{ height: COMPLAINT_MAP_HEIGHT_PX }}

    >

      <div className="flex flex-col items-center gap-2 text-sm text-gray-500">

        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />

        {message}

      </div>

    </div>

  );

}



function MapViewTab({

  active,

  disabled,

  hidden,

  label,

  title,

  onClick,

}: {

  active: boolean;

  disabled?: boolean;

  hidden?: boolean;

  label: string;

  title?: string;

  onClick?: () => void;

}) {

  if (hidden) return null;



  return (

    <button

      type="button"

      role="tab"

      aria-selected={active}

      disabled={disabled}

      title={title}

      onClick={onClick}

      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${

        disabled

          ? 'cursor-not-allowed border border-transparent text-gray-400'

          : active

            ? 'border border-brand-200 bg-brand-50 text-brand-800'

            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'

      }`}

    >

      {label}

    </button>

  );

}



function FilterSelect({

  label,

  value,

  onChange,

  options,

}: {

  label: string;

  value: string;

  onChange: (v: string) => void;

  options: { value: string; label: string }[];

}) {

  return (

    <div className="flex min-w-[110px] flex-col gap-0.5">

      <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">

        {label}

      </label>

      <select

        value={value}

        onChange={(e) => onChange(e.target.value)}

        className="h-8 max-w-[160px] rounded border border-gray-200 bg-white px-2 text-xs text-gray-800"

      >

        {options.map((o) => (

          <option key={o.value || '__all'} value={o.value}>

            {o.label}

          </option>

        ))}

      </select>

    </div>

  );

}


