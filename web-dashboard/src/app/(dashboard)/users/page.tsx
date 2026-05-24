'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usersApi } from '@/lib/api';
import { formatDate, getFullName } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Search, Plus, ChevronLeft, ChevronRight, Loader2, Eye,
  Users as UsersIcon, ShieldCheck,
} from 'lucide-react';
import { useTranslate } from '@/lib/i18n';

type Tab = 'staff' | 'citizens';

const STATUS_BADGE: Record<string, string> = {
  VERIFIED: 'bg-green-100 text-green-700',
  PENDING: 'bg-orange-100 text-orange-700',
  REJECTED: 'bg-red-100 text-red-700',
  UNVERIFIED: 'bg-gray-100 text-gray-700',
};

export default function UsersPage() {
  const t = useTranslate();
  const [tab, setTab] = useState<Tab>('staff');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['users', tab, page, search],
    queryFn: () =>
      usersApi.list({
        page,
        limit,
        search: search || undefined,
        ...(tab === 'citizens' ? { onlyCitizens: true } : { excludeCitizens: true }),
      }),
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const switchTab = (next: Tab) => {
    setTab(next);
    setPage(1);
    setSearch('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('users.title')}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{t('users.subtitle')}</p>
        </div>
        {tab === 'staff' && (
          <Link href="/users/new" className="btn-gov-primary shrink-0">
            <Plus className="h-4 w-4" /> {t('users.new')}
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        <TabButton active={tab === 'staff'} onClick={() => switchTab('staff')} icon={<UsersIcon className="h-4 w-4" />}>
          {t('users.tab.staff')}
        </TabButton>
        <TabButton active={tab === 'citizens'} onClick={() => switchTab('citizens')} icon={<ShieldCheck className="h-4 w-4" />}>
          {t('users.tab.citizens')}
        </TabButton>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={tab === 'staff' ? 'Search staff...' : 'Search citizens by name or email...'}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-500">Name</th>
              <th className="px-6 py-3 font-medium text-gray-500">Email</th>
              {tab === 'staff' ? (
                <>
                  <th className="px-6 py-3 font-medium text-gray-500">Department</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Roles</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                </>
              ) : (
                <>
                  <th className="px-6 py-3 font-medium text-gray-500">Phone</th>
                  <th className="px-6 py-3 font-medium text-gray-500">KYC</th>
                  <th className="px-6 py-3 font-medium text-gray-500">Status</th>
                </>
              )}
              <th className="px-6 py-3 font-medium text-gray-500">Joined</th>
              <th className="px-6 py-3 font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-gray-400" /></td></tr>
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-500">
                  {tab === 'citizens'
                    ? 'No self-registered citizens found.'
                    : 'No staff users found.'}
                </td>
              </tr>
            ) : (
              data?.items.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-gray-900">{getFullName(u)}</td>
                  <td className="px-6 py-3 text-gray-600">{u.email}</td>
                  {tab === 'staff' ? (
                    <>
                      <td className="px-6 py-3 text-gray-600">{u.department?.name || '—'}</td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles?.map((r: any) => (
                            <span key={r.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{r.name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-3 text-gray-600">{u.phone || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[u.verificationStatus] || STATUS_BADGE.UNVERIFIED)}>
                          {u.verificationStatus || 'UNVERIFIED'}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="px-6 py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                  <td className="px-6 py-3">
                    <Link href={`/users/${u.id}`} className="flex items-center gap-1 text-brand-600 hover:text-brand-700">
                      <Eye className="h-4 w-4" /> {tab === 'citizens' ? 'Manage' : 'View'}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
            <p className="text-sm text-gray-500">Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!data.meta.hasPrevPage} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-50"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={() => setPage((p) => p + 1)} disabled={!data.meta.hasNextPage} className="rounded-lg border border-gray-300 p-1.5 hover:bg-gray-50 disabled:opacity-50"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors -mb-px',
        active
          ? 'border-brand-600 text-brand-700'
          : 'border-transparent text-gray-500 hover:text-gray-700',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
