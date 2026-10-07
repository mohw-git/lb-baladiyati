import type { Ionicons } from '@expo/vector-icons';

export function notificationIcon(type?: string): keyof typeof Ionicons.glyphMap {
  const t = String(type ?? '').toUpperCase();
  if (t.startsWith('COMPLAINT_')) return 'document-text-outline';
  if (t.startsWith('HELP_')) return 'hand-left-outline';
  if (t.startsWith('TRANSFER_')) return 'swap-horizontal-outline';
  if (t.startsWith('KYC_')) return 'shield-checkmark-outline';
  if (t.startsWith('NEWS_')) return 'newspaper-outline';
  if (t.startsWith('TASK_')) return 'clipboard-outline';
  return 'notifications-outline';
}
