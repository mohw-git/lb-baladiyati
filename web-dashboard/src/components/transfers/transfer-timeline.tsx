'use client';

import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Ban,
} from 'lucide-react';
import type { TransferRequest, TransferStatus } from '@shared/types/transfer';
import { formatDate } from '@/lib/utils';
import { useTranslate, useLocale, isRtl, pickName, type MessageKey } from '@/lib/i18n';

const STATUS_META: Record<
  TransferStatus,
  { labelKey: MessageKey; color: string; icon: any }
> = {
  PENDING: { labelKey: 'transfers.status.PENDING', color: 'text-amber-600', icon: Clock },
  ACCEPTED: { labelKey: 'transfers.status.ACCEPTED', color: 'text-green-600', icon: CheckCircle2 },
  REJECTED: { labelKey: 'transfers.status.REJECTED', color: 'text-red-600', icon: XCircle },
  CANCELLED: { labelKey: 'transfers.status.CANCELED', color: 'text-gray-500', icon: Ban },
  AUTO_CANCELLED: { labelKey: 'transfers.status.WITHDRAWN', color: 'text-gray-500', icon: Ban },
};

interface Props {
  transfers: TransferRequest[];
}

export function TransferTimeline({ transfers }: Props) {
  const t = useTranslate();
  const locale = useLocale();
  const rtl = isRtl(locale);

  if (!transfers.length) return null;

  const Arrow = rtl ? ArrowLeft : ArrowRight;

  return (
    <div className="gov-card p-4">
      <div className="gov-section-header">{t('transfers.timeline.title')}</div>
      <ol className="mt-3 space-y-2">
        {transfers.map((tr) => {
          const meta = STATUS_META[tr.status];
          const Icon = meta.icon;
          return (
            <li
              key={tr.id}
              className="flex gap-3 rounded border border-gray-100 bg-gray-50/60 p-3"
            >
              <div className="mt-0.5">
                <Icon className={`h-5 w-5 ${meta.color}`} />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-center gap-1.5 text-gray-900">
                  <span className="font-medium">{tr.fromDepartment ? pickName(tr.fromDepartment as any, locale) : '—'}</span>
                  <Arrow className="h-3.5 w-3.5 text-gray-400" />
                  <span className="font-medium">{tr.toDepartment ? pickName(tr.toDepartment as any, locale) : '—'}</span>
                  <span className={`ml-1 rounded px-2 py-0.5 text-[11px] font-semibold ${meta.color} bg-white ring-1 ring-current/20`}>
                    {t(meta.labelKey)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-700">
                  <span className="font-medium">{t('transfers.timeline.reason')}:</span> {tr.reason}
                </p>
                {tr.responseReason && (
                  <p className="mt-1 text-xs text-gray-700">
                    <span className="font-medium">{t('common.notes')}:</span>{' '}
                    {tr.responseReason}
                  </p>
                )}
                {tr.newAssignee && (
                  <p className="mt-1 text-xs text-gray-700">
                    <span className="font-medium">{t('transfers.timeline.assignedTo')}:</span>{' '}
                    {tr.newAssignee.firstName} {tr.newAssignee.lastName}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-gray-500">
                  {t('transfers.timeline.requestedBy')}: {tr.requestedBy?.firstName} {tr.requestedBy?.lastName} ·{' '}
                  {formatDate(tr.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
