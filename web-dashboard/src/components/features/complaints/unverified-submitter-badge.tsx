'use client';

import { ShieldAlert } from 'lucide-react';
import { useTranslate, type MessageKey } from '@/lib/i18n';
import type { ComplaintRiskReason } from '@shared/types/complaint';

function reasonLabelKey(reason: ComplaintRiskReason): MessageKey {
  if (reason === 'UNVERIFIED_EMAIL') return 'complaints.risk.reason.email';
  return 'complaints.risk.reason.kyc';
}

export function UnverifiedSubmitterBadge({
  riskReasons = [],
  className = '',
}: {
  riskReasons?: ComplaintRiskReason[];
  className?: string;
}) {
  const t = useTranslate();
  const reasons = riskReasons.length
    ? riskReasons
    : (['UNVERIFIED_EMAIL', 'UNVERIFIED_KYC'] as ComplaintRiskReason[]);

  const tooltip = reasons.map((r) => t(reasonLabelKey(r))).join(' · ');

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 ${className}`}
      title={tooltip}
    >
      <ShieldAlert className="h-3 w-3" />
      {t('complaints.risk.badge')}
    </span>
  );
}
