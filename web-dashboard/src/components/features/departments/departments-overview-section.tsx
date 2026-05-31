'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRightLeft, Loader2 } from 'lucide-react';
import { complaintsApi, municipalitiesApi } from '@/lib/api';
import { useAnyPermission, usePermission } from '@/lib/auth';
import { PERMISSIONS } from '@shared/constants/permissions';
import type { DepartmentWorkloadRow } from '@shared/types/department';
import type { Locale } from '@shared/types/locale';
import { pickName, useLocale, useTranslate } from '@/lib/i18n';
import { getFullName } from '@/lib/utils';
import {
  healthBadgeClass,
  healthRowClass,
  healthScoreTextClass,
} from '@/lib/departments/department-health-ui';

export function DepartmentsOverviewSection({
  canManageDepartments,
}: {
  canManageDepartments: boolean;
}) {
  const t = useTranslate();
  const locale = useLocale();
  const canViewAll = usePermission(PERMISSIONS.COMPLAINT_VIEW_ALL);
  const canViewDept = usePermission(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT);
  const showOutbound = useAnyPermission(
    PERMISSIONS.DEPARTMENT_CREATE,
    PERMISSIONS.DEPARTMENT_UPDATE,
  );

  const { data: rows, isLoading, isError, refetch } = useQuery({
    queryKey: ['complaints', 'department-workload'],
    queryFn: () => complaintsApi.getDepartmentWorkload(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: muni } = useQuery({
    queryKey: ['municipality', 'current'],
    queryFn: () => municipalitiesApi.getCurrent(),
    enabled: canManageDepartments,
    staleTime: 120_000,
  });

  const vacantHodCount = (rows ?? []).filter((r) => !r.head).length;
  const muniAdminVacant = canManageDepartments && muni && !muni.adminUserId;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-alert-200 bg-alert-50 px-4 py-8 text-center">
        <p className="text-sm font-medium text-alert-800">{t('departments.overview.error')}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const sorted = [...(rows ?? [])].sort((a, b) => b.healthScore - a.healthScore);

  return (
    <div className="space-y-4">
      {muniAdminVacant && (
        <div className="flex items-start gap-3 rounded border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">{t('departments.overview.vacantAdmin')}</p>
        </div>
      )}

      {vacantHodCount > 0 && (
        <div className="flex items-start gap-3 rounded border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-900">
            {t('departments.overview.vacantHod').replace('{count}', String(vacantHodCount))}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <HealthLegend health="healthy" label={t('departments.overview.health.healthy')} />
        <HealthLegend health="elevated" label={t('departments.overview.health.elevated')} />
        <HealthLegend health="overloaded" label={t('departments.overview.health.overloaded')} />
      </div>

      {!sorted.length ? (
        <p className="py-8 text-center text-sm text-gray-500">{t('common.noData')}</p>
      ) : (
        <div className="gov-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="gov-table w-full min-w-[720px]">
              <thead>
                <tr>
                  <th>{t('departments.col.name')}</th>
                  <th>{t('departments.hod.label')}</th>
                  <th className="text-center">{t('departments.col.staff')}</th>
                  <th className="text-center">{t('departments.overview.col.active')}</th>
                  <th className="text-center">{t('departments.overview.col.overdue')}</th>
                  <th className="text-center">{t('departments.overview.col.transfersIn')}</th>
                  {showOutbound && (
                    <th className="text-center">{t('departments.overview.col.transfersOut')}</th>
                  )}
                  <th className="text-center">{t('departments.overview.col.healthScore')}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((dept) => (
                  <OverviewRow
                    key={dept.id}
                    dept={dept}
                    locale={locale}
                    canViewAll={canViewAll}
                    canViewDept={canViewDept}
                    showOutbound={showOutbound}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewRow({
  dept,
  locale,
  canViewAll,
  canViewDept,
  showOutbound,
}: {
  dept: DepartmentWorkloadRow;
  locale: Locale;
  canViewAll: boolean;
  canViewDept: boolean;
  showOutbound: boolean;
}) {
  const t = useTranslate();
  const complaintsBucket = canViewAll ? 'all' : canViewDept ? 'myDepartment' : 'all';
  const complaintsBase = `/complaints?bucket=${complaintsBucket}${
    canViewAll ? `&departmentId=${dept.id}` : ''
  }`;
  const overdueHref = canViewAll
    ? `/complaints?bucket=overdue&departmentId=${dept.id}`
    : `/complaints?bucket=overdue`;
  const transfersInHref = '/transfers?tab=inbox';
  const transfersOutHref = '/transfers?tab=outgoing';

  return (
    <tr className={`border-s-4 ${healthRowClass(dept.health)}`}>
      <td className="px-4 py-3">
        <Link href={complaintsBase} className="font-medium text-gray-900 hover:text-brand-700 hover:underline">
          {pickName(dept, locale)}
        </Link>
      </td>
      <td className="px-4 py-3">
        {dept.head ? (
          <span className="text-sm text-gray-800">{getFullName(dept.head as any)}</span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3 w-3" /> {t('departments.hod.vacant')}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center text-sm text-gray-700">{dept.staffCount}</td>
      <td className="px-4 py-3 text-center">
        <Link href={complaintsBase} className="font-semibold text-brand-700 hover:underline">
          {dept.activeComplaints}
        </Link>
      </td>
      <td className="px-4 py-3 text-center">
        <Link
          href={overdueHref}
          className={`font-semibold hover:underline ${
            dept.overdueComplaints > 0 ? 'text-alert-700' : 'text-gray-500'
          }`}
        >
          {dept.overdueComplaints}
        </Link>
      </td>
      <td className="px-4 py-3 text-center">
        {dept.pendingTransfersIn > 0 ? (
          <Link
            href={transfersInHref}
            className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:underline"
          >
            <ArrowRightLeft className="h-3 w-3" />
            {dept.pendingTransfersIn}
          </Link>
        ) : (
          <span className="text-gray-400">0</span>
        )}
      </td>
      {showOutbound && (
        <td className="px-4 py-3 text-center">
          {(dept.pendingTransfersOut ?? 0) > 0 ? (
            <Link
              href={transfersOutHref}
              className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:underline"
            >
              <ArrowRightLeft className="h-3 w-3" />
              {dept.pendingTransfersOut}
            </Link>
          ) : (
            <span className="text-gray-400">0</span>
          )}
        </td>
      )}
      <td className="px-4 py-3 text-center">
        <span
          className={`inline-flex min-w-[3rem] flex-col items-center rounded px-2 py-1 text-xs font-bold ${healthBadgeClass(dept.health)}`}
        >
          <span className={healthScoreTextClass(dept.health)}>{dept.healthScore}</span>
          <span className="font-normal capitalize opacity-90">
            {t(`departments.overview.health.${dept.health}` as 'departments.overview.health.healthy')}
          </span>
        </span>
      </td>
    </tr>
  );
}

function HealthLegend({
  health,
  label,
}: {
  health: DepartmentWorkloadRow['health'];
  label: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ring-1 ring-gray-200 ${healthBadgeClass(health)}`}>
      {label}
    </span>
  );
}
