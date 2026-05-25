'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { rolesApi } from '@/lib/api';
import { Loader2, Plus, Eye } from 'lucide-react';
import { useLocale, useTranslate } from '@/lib/i18n';
import { pickName, pickDescription } from '@shared/types/locale';

export default function RolesPage() {
  const locale = useLocale();
  const t = useTranslate();
  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('roles.title')}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('roles.subtitle')}</p>
        </div>
        <Link href="/roles/new" className="btn-gov-primary">
          <Plus className="h-4 w-4" /> {t('roles.new')}
        </Link>
      </div>

      <div className="gov-card overflow-hidden">
        <table className="gov-table w-full">
          <thead>
            <tr>
              <th>{t('roles.col.priority')}</th>
              <th>{t('roles.col.name')}</th>
              <th>{t('roles.col.description')}</th>
              <th>{t('roles.col.system')}</th>
              <th>{t('roles.col.permissions')}</th>
              <th>{t('roles.col.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" />
                </td>
              </tr>
            ) : !roles?.length ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-sm text-gray-500">
                  {t('roles.empty')}
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id}>
                  <td>
                    <PriorityBadge priority={(role as any).priority ?? 0} />
                  </td>
                  <td className="font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {pickName(role as any, locale)}
                      {(role as any).isSystemManaged && (
                        <span
                          className="inline-flex items-center rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple-800"
                          title={t('roles.badge.positional.hint')}
                        >
                          {t('roles.badge.positional')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[280px] truncate text-gray-600">
                    {pickDescription(role as any, locale) || '—'}
                  </td>
                  <td>
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        role.isSystem
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                      title={role.isSystem ? t('roles.protectedNotice') : undefined}
                    >
                      {role.isSystem ? t('roles.badge.yes') : t('roles.badge.no')}
                    </span>
                  </td>
                  <td className="text-gray-600">{role.permissions?.length ?? 0}</td>
                  <td>
                    <Link
                      href={`/roles/${role.id}`}
                      className="flex items-center gap-1 text-brand-600 hover:text-brand-700"
                    >
                      <Eye className="h-4 w-4" /> {t('roles.view')}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  let cls = 'bg-gray-100 text-gray-700';
  if (priority >= 100) cls = 'bg-red-100 text-red-700';
  else if (priority >= 80) cls = 'bg-orange-100 text-orange-700';
  else if (priority >= 60) cls = 'bg-amber-100 text-amber-700';
  else if (priority >= 40) cls = 'bg-blue-100 text-blue-700';
  else if (priority > 0) cls = 'bg-slate-100 text-slate-600';
  return (
    <span className={`inline-flex w-10 justify-center rounded px-1.5 py-0.5 text-xs font-semibold ${cls}`}>
      {priority}
    </span>
  );
}
