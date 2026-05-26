import { Colors } from '../../constants/theme';
import type { MessageKey } from '../i18n/messages';

export type PriorityBadge = {
  label: string;
  color: string;
  bg: string;
};

const PRIORITY_STYLE: Record<
  string,
  { labelKey: MessageKey; color: string; bg: string }
> = {
  LOW: { labelKey: 'priority.LOW', color: Colors.gray[600], bg: Colors.gray[100] },
  MEDIUM: { labelKey: 'priority.MEDIUM', color: Colors.blue[700], bg: Colors.blue[100] },
  HIGH: { labelKey: 'priority.HIGH', color: Colors.orange[700], bg: Colors.orange[100] },
  URGENT: { labelKey: 'priority.URGENT', color: Colors.red[700], bg: Colors.red[100] },
};

export function getPriorityBadge(
  priority: string | undefined,
  t: (key: MessageKey) => string,
): PriorityBadge {
  const cfg = PRIORITY_STYLE[priority ?? ''] ?? PRIORITY_STYLE.MEDIUM;
  return { label: t(cfg.labelKey), color: cfg.color, bg: cfg.bg };
}
