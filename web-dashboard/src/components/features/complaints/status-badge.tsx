'use client';

import { cn } from '@/lib/utils';
import { ComplaintStatus } from '@shared/types/complaint';
import { STATUS_COLORS } from '@shared/constants/status';
import { useTranslate } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n';

interface StatusBadgeProps {
  status: ComplaintStatus;
  className?: string;
}

const STATUS_I18N_KEYS: Record<ComplaintStatus, MessageKey> = {
  [ComplaintStatus.SUBMITTED]: 'status.SUBMITTED',
  [ComplaintStatus.UNDER_REVIEW]: 'status.UNDER_REVIEW',
  [ComplaintStatus.ASSIGNED]: 'status.ASSIGNED',
  [ComplaintStatus.IN_PROGRESS]: 'status.IN_PROGRESS',
  [ComplaintStatus.PENDING_APPROVAL]: 'status.PENDING_APPROVAL',
  [ComplaintStatus.COMPLETED]: 'status.COMPLETED',
  [ComplaintStatus.REJECTED]: 'status.REJECTED',
  [ComplaintStatus.CLOSED]: 'status.CLOSED',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslate();
  const colors = STATUS_COLORS[status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
  const labelKey = STATUS_I18N_KEYS[status];
  const label = labelKey ? t(labelKey) : status.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        colors.bg,
        colors.text,
        className,
      )}
    >
      {label}
    </span>
  );
}
