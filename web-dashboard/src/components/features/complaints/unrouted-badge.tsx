'use client';

import { useTranslate } from '@/lib/i18n';

/** Complaint has no routed department (departmentId is null). */
export function UnroutedBadge() {
  const t = useTranslate();
  return (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
      {t('complaints.badge.unrouted')}
    </span>
  );
}
