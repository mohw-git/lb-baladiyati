'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  HandHelping, Inbox, Send, Loader2, ArrowRight,
} from 'lucide-react';
import { helpRequestsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/hooks';
import { PERMISSIONS } from '@shared/constants/permissions';
import type { HelpRequest, HelpRequestStatus } from '@shared/types/help-request';
import { formatDate, getFullName } from '@/lib/utils';
import { useTranslate, type MessageKey } from '@/lib/i18n';

const STATUS_BADGE: Record<HelpRequestStatus, { cls: string; labelKey: MessageKey }> = {
  PENDING:     { cls: 'bg-yellow-100 text-yellow-800', labelKey: 'helpRequests.status.PENDING' },
  ACCEPTED:    { cls: 'bg-blue-100 text-blue-800',     labelKey: 'helpRequests.status.ACCEPTED' },
  IN_PROGRESS: { cls: 'bg-blue-100 text-blue-800',     labelKey: 'helpRequests.status.IN_PROGRESS' },
  SUBMITTED:   { cls: 'bg-purple-100 text-purple-800', labelKey: 'helpRequests.status.SUBMITTED' },
  COMPLETED:   { cls: 'bg-green-100 text-green-800',   labelKey: 'helpRequests.status.APPROVED' },
  DECLINED:    { cls: 'bg-rose-100 text-rose-800',     labelKey: 'helpRequests.status.DECLINED' },
  REJECTED:    { cls: 'bg-rose-100 text-rose-800',     labelKey: 'helpRequests.status.DECLINED' },
  CANCELLED:   { cls: 'bg-gray-100 text-gray-700',     labelKey: 'helpRequests.status.CANCELED' },
};

export default function HelpRequestsPage() {
  const { user } = useAuth();
  const t = useTranslate();
  const [tab, setTab] = useState<'inbox' | 'outgoing'>('inbox');

  const canRespond = user?.permissions?.includes(PERMISSIONS.HELP_RESPOND);
  const canRequest = user?.permissions?.includes(PERMISSIONS.HELP_REQUEST);

  const { data, isLoading } = useQuery({
    queryKey: ['help-requests', tab],
    queryFn: () =>
      helpRequestsApi.list({
        inbox: tab === 'inbox' || undefined,
        outgoing: tab === 'outgoing' || undefined,
        limit: 100,
      }),
  });

  const items: HelpRequest[] = data?.items ?? [];
  const open = items.filter((h) =>
    ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'SUBMITTED'].includes(h.status),
  );
  const past = items.filter((h) => !open.includes(h));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <HandHelping className="h-5 w-5" /> {t('helpRequests.title')}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">{t('helpRequests.subtitle')}</p>
      </div>

      <div className="flex gap-2">
        {canRespond && (
          <TabButton active={tab === 'inbox'} onClick={() => setTab('inbox')}
            label={t('helpRequests.section.incoming')} icon={<Inbox className="h-4 w-4" />}
            count={tab === 'inbox' ? open.filter((h) => h.status === 'PENDING').length : undefined}
          />
        )}
        {canRequest && (
          <TabButton active={tab === 'outgoing'} onClick={() => setTab('outgoing')}
            label={t('helpRequests.section.outgoing')} icon={<Send className="h-4 w-4" />}
          />
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded border border-gray-200 bg-white py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <Empty tab={tab} />
      ) : (
        <div className="space-y-4">
          {open.length > 0 && (
            <Section title={t('common.active')} items={open} />
          )}
          {past.length > 0 && (
            <Section title={t('common.inactive')} items={past} muted />
          )}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active, onClick, label, icon, count,
}: {
  active: boolean; onClick: () => void; label: string; icon: React.ReactNode; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ${
        active ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
      }`}
    >
      {icon} {label}
      {count != null && count > 0 && (
        <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${active ? 'bg-white text-brand-700' : 'bg-amber-100 text-amber-800'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function Empty({ tab }: { tab: 'inbox' | 'outgoing' }) {
  const t = useTranslate();
  return (
    <div className="rounded border border-dashed border-gray-200 bg-white py-16 text-center">
      <HandHelping className="mx-auto h-8 w-8 text-gray-300" />
      <p className="mt-3 text-sm font-medium text-gray-900">
        {t('helpRequests.empty')}
      </p>
    </div>
  );
}

function Section({
  title, items, muted,
}: { title: string; items: HelpRequest[]; muted?: boolean }) {
  const t = useTranslate();
  return (
    <div>
      <h2 className={`mb-2 text-sm font-semibold ${muted ? 'text-gray-500' : 'text-gray-900'}`}>{title}</h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <ul className="divide-y divide-gray-100">
          {items.map((h) => {
            const s = STATUS_BADGE[h.status];
            return (
              <li key={h.id}>
                <Link
                  href={`/complaints/${h.complaintId}`}
                  className="flex items-start gap-3 p-4 hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {h.complaint?.title ?? 'Complaint'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {h.complaint?.referenceCode}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                        {t(s.labelKey)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {h.fromDepartment?.name} <ArrowRight className="inline h-3 w-3" /> {h.toDepartment?.name}
                      {' · '} raised by {h.requestedBy ? getFullName(h.requestedBy) : 'unknown'}
                      {' · '} {formatDate(h.createdAt, 'MMM d, HH:mm')}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-700">
                      {h.reason}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
