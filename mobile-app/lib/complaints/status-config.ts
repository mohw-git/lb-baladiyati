import { Colors } from '../../constants/theme';
import type { MessageKey } from '../i18n/messages';

export type ComplaintStatusBadge = {
  label: string;
  color: string;
  bg: string;
  icon?: string;
};

const STATUS_STYLE: Record<
  string,
  { labelKey: MessageKey; color: string; bg: string; icon?: string }
> = {
  SUBMITTED: {
    labelKey: 'status.SUBMITTED',
    color: Colors.brand[700],
    bg: Colors.brand[100],
    icon: 'paper-plane',
  },
  UNDER_REVIEW: {
    labelKey: 'status.UNDER_REVIEW',
    color: Colors.purple[700],
    bg: Colors.purple[100],
    icon: 'eye',
  },
  ASSIGNED: {
    labelKey: 'status.ASSIGNED',
    color: Colors.orange[700],
    bg: Colors.orange[100],
    icon: 'person-add',
  },
  IN_PROGRESS: {
    labelKey: 'status.IN_PROGRESS',
    color: Colors.yellow[700],
    bg: Colors.yellow[100],
    icon: 'construct',
  },
  PENDING_APPROVAL: {
    labelKey: 'status.PENDING_APPROVAL',
    color: Colors.purple[700],
    bg: Colors.purple[100],
    icon: 'hourglass',
  },
  COMPLETED: {
    labelKey: 'status.COMPLETED',
    color: Colors.green[700],
    bg: Colors.green[100],
    icon: 'checkmark-circle',
  },
  REJECTED: {
    labelKey: 'status.REJECTED',
    color: Colors.red[700],
    bg: Colors.red[100],
    icon: 'close-circle',
  },
  CLOSED: {
    labelKey: 'status.CLOSED',
    color: Colors.gray[600],
    bg: Colors.gray[100],
    icon: 'lock-closed',
  },
};

export function getComplaintStatusBadge(
  status: string | undefined,
  t: (key: MessageKey) => string,
): ComplaintStatusBadge {
  const cfg = STATUS_STYLE[status ?? ''] ?? STATUS_STYLE.SUBMITTED;
  return {
    label: t(cfg.labelKey),
    color: cfg.color,
    bg: cfg.bg,
    icon: cfg.icon,
  };
}
