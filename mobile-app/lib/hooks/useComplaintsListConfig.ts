import { useMemo } from 'react';
import { useIsFieldWorker } from './usePermission';
import type { MessageKey } from '../i18n/messages';

export type ComplaintsListMode = 'citizen' | 'worker';

export function useComplaintsListConfig() {
  const isFieldWorker = useIsFieldWorker();

  return useMemo(() => {
    if (isFieldWorker) {
      return {
        mode: 'worker' as ComplaintsListMode,
        queryKey: ['complaints', 'assigned'] as const,
        listParams: { myAssignments: true } as Record<string, unknown>,
        titleKey: 'complaints.title.worker' as MessageKey,
        emptyKey: 'complaints.empty.worker' as MessageKey,
        emptyHintKey: 'complaints.emptyHint.worker' as MessageKey,
        showReportCta: false,
      };
    }
    return {
      mode: 'citizen' as ComplaintsListMode,
      queryKey: ['my-complaints'] as const,
      listParams: {} as Record<string, unknown>,
      titleKey: 'complaints.title.citizen' as MessageKey,
      emptyKey: 'complaints.empty.citizen' as MessageKey,
      emptyHintKey: 'complaints.emptyHint.citizen' as MessageKey,
      showReportCta: true,
    };
  }, [isFieldWorker]);
}
