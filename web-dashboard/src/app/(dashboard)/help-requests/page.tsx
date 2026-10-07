'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  HandHelping, Inbox, Send, Loader2, ArrowRight, UserPlus, PlayCircle, ClipboardCheck, History,
} from 'lucide-react';
import { helpRequestsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/hooks';
import { PERMISSIONS } from '@shared/constants/permissions';
import type { HelpRequest, HelpRequestQueue, HelpRequestStatus } from '@shared/types/help-request';
import { formatDate, getFullName } from '@/lib/utils';
import { useTranslate, type MessageKey } from '@/lib/i18n';

const STATUS_BADGE: Record<HelpRequestStatus, { cls: string; labelKey: MessageKey }> = {
  PENDING_SOURCE_APPROVAL: { cls: 'bg-orange-100 text-orange-800', labelKey: 'helpRequests.status.PENDING_SOURCE_APPROVAL' },
  SOURCE_REJECTED:         { cls: 'bg-rose-100 text-rose-800',     labelKey: 'helpRequests.status.SOURCE_REJECTED' },
  PENDING:                 { cls: 'bg-yellow-100 text-yellow-800', labelKey: 'helpRequests.status.PENDING_RECEIVER' },
  ACCEPTED:                { cls: 'bg-blue-100 text-blue-800',     labelKey: 'helpRequests.status.ACCEPTED' },
  IN_PROGRESS:             { cls: 'bg-blue-100 text-blue-800',     labelKey: 'helpRequests.status.IN_PROGRESS' },
  SUBMITTED:               { cls: 'bg-purple-100 text-purple-800', labelKey: 'helpRequests.status.SUBMITTED' },
  COMPLETED:               { cls: 'bg-green-100 text-green-800',   labelKey: 'helpRequests.status.APPROVED' },
  DECLINED:                { cls: 'bg-rose-100 text-rose-800',     labelKey: 'helpRequests.status.DECLINED' },
  REJECTED:                { cls: 'bg-rose-100 text-rose-800',     labelKey: 'helpRequests.status.REJECTED_RESULT' },
  CANCELLED:               { cls: 'bg-gray-100 text-gray-700',     labelKey: 'helpRequests.status.CANCELED' },
};

type TabDef = {
  id: HelpRequestQueue;
  labelKey: MessageKey;
  icon: React.ReactNode;
  countKey?: keyof import('@shared/types/help-request').HelpPendingCounts;
};

export default function HelpRequestsPage() {
  const { user } = useAuth();
  const t = useTranslate();

  const canRespond = user?.permissions?.includes(PERMISSIONS.HELP_RESPOND);
  const canRequest = user?.permissions?.includes(PERMISSIONS.HELP_REQUEST);
  const canSourceApprove =
    canRespond ||
    user?.permissions?.includes(PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT);
  const isHelperOnly = !canRespond && !canSourceApprove && user?.permissions?.includes(PERMISSIONS.HELP_VIEW);

  const tabs = useMemo((): TabDef[] => {
    const list: TabDef[] = [];
    if (isHelperOnly) {
      list.push({
        id: 'myAssignments',
        labelKey: 'helpRequests.section.inProgress',
        icon: <PlayCircle className="h-4 w-4" />,
        countKey: 'myAssignmentsCount',
      });
      list.push({
        id: 'history',
        labelKey: 'helpRequests.section.history',
        icon: <History className="h-4 w-4" />,
      });
      return list;
    }
    if (canSourceApprove) {
      list.push({
        id: 'sourceApproval',
        labelKey: 'helpRequests.section.sourceApproval',
        icon: <HandHelping className="h-4 w-4" />,
        countKey: 'sourceCount',
      });
      list.push({
        id: 'awaitingSourceReview',
        labelKey: 'helpRequests.section.awaitingSourceReview',
        icon: <ClipboardCheck className="h-4 w-4" />,
        countKey: 'awaitingSourceReviewCount',
      });
    }
    if (canRespond) {
      list.push({
        id: 'incoming',
        labelKey: 'helpRequests.section.incoming',
        icon: <Inbox className="h-4 w-4" />,
        countKey: 'receiverCount',
      });
      list.push({
        id: 'needsAssignment',
        labelKey: 'helpRequests.section.needsAssignment',
        icon: <UserPlus className="h-4 w-4" />,
        countKey: 'needsAssignmentCount',
      });
      list.push({
        id: 'inProgress',
        labelKey: 'helpRequests.section.inProgress',
        icon: <PlayCircle className="h-4 w-4" />,
        countKey: 'inProgressCount',
      });
    }
    if (canRequest && !canRespond) {
      list.push({
        id: 'sourceApproval',
        labelKey: 'helpRequests.section.sourceApproval',
        icon: <HandHelping className="h-4 w-4" />,
        countKey: 'sourceCount',
      });
      list.push({
        id: 'awaitingSourceReview',
        labelKey: 'helpRequests.section.awaitingSourceReview',
        icon: <ClipboardCheck className="h-4 w-4" />,
        countKey: 'awaitingSourceReviewCount',
      });
    }
    if (canRespond) {
      list.push({
        id: 'myAssignments',
        labelKey: 'helpRequests.section.myAssignments',
        icon: <Send className="h-4 w-4" />,
        countKey: 'myAssignmentsCount',
      });
    }
    list.push({
      id: 'history',
      labelKey: 'helpRequests.section.history',
      icon: <History className="h-4 w-4" />,
    });
    return list;
  }, [canRespond, canRequest, canSourceApprove, isHelperOnly]);

  const [tab, setTab] = useState<HelpRequestQueue>(tabs[0]?.id ?? 'history');

  const { data: pendingCounts } = useQuery({
    queryKey: ['help-requests', 'pending-count'],
    queryFn: () => helpRequestsApi.pendingCount(),
    enabled: tabs.length > 0,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['help-requests', 'queue', tab],
    queryFn: () => helpRequestsApi.list({ queue: tab, limit: 100 }),
    enabled: !!tab,
  });

  const items: HelpRequest[] = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
          <HandHelping className="h-5 w-5" /> {t('helpRequests.title')}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">{t('helpRequests.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tb) => (
          <TabButton
            key={tb.id}
            active={tab === tb.id}
            onClick={() => setTab(tb.id)}
            label={t(tb.labelKey)}
            icon={tb.icon}
            count={
              tb.countKey && pendingCounts
                ? (pendingCounts[tb.countKey] as number | undefined)
                : undefined
            }
          />
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center rounded border border-gray-200 bg-white py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <Empty />
      ) : (
        <HelpRequestList items={items} />
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

function Empty() {
  const t = useTranslate();
  return (
    <div className="rounded border border-dashed border-gray-200 bg-white py-16 text-center">
      <HandHelping className="mx-auto h-8 w-8 text-gray-300" />
      <p className="mt-3 text-sm font-medium text-gray-900">{t('helpRequests.empty')}</p>
    </div>
  );
}

function HelpRequestList({ items }: { items: HelpRequest[] }) {
  const t = useTranslate();
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <ul className="divide-y divide-gray-100">
        {items.map((h) => {
          const s = STATUS_BADGE[h.status];
          return (
            <li key={h.id}>
              <Link
                href={`/help-requests/${h.id}`}
                className="flex items-start gap-3 p-4 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">
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
                    {' · '} {t('helpRequests.panel.requester')}: {h.requestedBy ? getFullName(h.requestedBy) : '—'}
                    {' · '} {formatDate(h.createdAt, 'MMM d, HH:mm')}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-gray-700">{h.reason}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
