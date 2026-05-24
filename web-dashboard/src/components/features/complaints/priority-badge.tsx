'use client';

import { Flag } from 'lucide-react';
import { ComplaintPriority } from '@shared/types/complaint';
import { PRIORITY_COLORS } from '@shared/constants/status';
import { cn } from '@/lib/utils';
import { useTranslate } from '@/lib/i18n';
import type { MessageKey } from '@/lib/i18n';

interface PriorityBadgeProps {
  priority?: ComplaintPriority | null;
  className?: string;
}

const PRIORITY_I18N_KEYS: Record<ComplaintPriority, MessageKey> = {
  [ComplaintPriority.LOW]: 'priority.LOW',
  [ComplaintPriority.MEDIUM]: 'priority.MEDIUM',
  [ComplaintPriority.HIGH]: 'priority.HIGH',
  [ComplaintPriority.URGENT]: 'priority.URGENT',
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const t = useTranslate();

  if (!priority) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-500',
          className,
        )}
      >
        <Flag className="h-3 w-3" />
        {t('common.na')}
      </span>
    );
  }

  const colors = PRIORITY_COLORS[priority];
  const labelKey = PRIORITY_I18N_KEYS[priority];
  const label = labelKey ? t(labelKey) : priority;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold',
        colors.bg,
        colors.text,
        className,
      )}
    >
      <Flag className="h-3 w-3" />
      {label}
    </span>
  );
}
