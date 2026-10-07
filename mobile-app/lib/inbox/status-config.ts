import { Colors } from '../../constants/theme';
import type { MessageKey } from '../i18n/messages';

export type InboxStatusStyle = {
  labelKey: MessageKey;
  bg: string;
  color: string;
};

const HELP_STATUS: Record<string, InboxStatusStyle> = {
  PENDING: { labelKey: 'helpStatus.PENDING', bg: Colors.yellow[100], color: Colors.yellow[700] },
  ACCEPTED: { labelKey: 'helpStatus.ACCEPTED', bg: Colors.blue[100], color: Colors.blue[700] },
  IN_PROGRESS: { labelKey: 'helpStatus.IN_PROGRESS', bg: Colors.blue[100], color: Colors.blue[700] },
  SUBMITTED: { labelKey: 'helpStatus.SUBMITTED', bg: Colors.purple[100], color: Colors.purple[700] },
  COMPLETED: { labelKey: 'helpStatus.COMPLETED', bg: Colors.green[100], color: Colors.green[700] },
  REJECTED: { labelKey: 'helpStatus.REJECTED', bg: Colors.red[100], color: Colors.red[700] },
  DECLINED: { labelKey: 'helpStatus.DECLINED', bg: Colors.red[100], color: Colors.red[700] },
  CANCELLED: { labelKey: 'helpStatus.CANCELLED', bg: Colors.gray[100], color: Colors.gray[600] },
  AUTO_CANCELLED: { labelKey: 'helpStatus.AUTO_CANCELLED', bg: Colors.gray[100], color: Colors.gray[600] },
};

export function getInboxStatusStyle(status: string | undefined): InboxStatusStyle {
  return HELP_STATUS[status ?? ''] ?? {
    labelKey: 'helpStatus.PENDING',
    bg: Colors.gray[100],
    color: Colors.gray[700],
  };
}
