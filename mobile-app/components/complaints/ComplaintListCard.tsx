import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GovCard } from '../ui/gov-card';
import { StatusChip } from '../ui/status-chip';
import { PriorityChip } from './PriorityChip';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { useIsRtl, useTranslate } from '../../lib/i18n';
import { flexRow, chevronForward, textAlignStart } from '../../lib/ui/rtl';

export type ComplaintListItem = {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  referenceCode?: string;
  category?: { name?: string } | null;
  address?: string | null;
  createdAt: string;
  isOverdue?: boolean;
  dueDate?: string | null;
};

type ComplaintListCardProps = {
  item: ComplaintListItem;
  onPress: () => void;
  actionLabel?: string;
};

export function ComplaintListCard({ item, onPress, actionLabel }: ComplaintListCardProps) {
  const t = useTranslate();
  const rtl = useIsRtl();
  const action = actionLabel ?? t('complaints.open');

  return (
    <GovCard onPress={onPress} style={styles.card} accent={item.isOverdue ? 'warning' : 'none'}>
      <View style={[styles.topRow, flexRow(rtl)]}>
        {item.referenceCode ? (
          <Text style={[styles.ref, textAlignStart(rtl)]} numberOfLines={1}>
            {item.referenceCode}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={[styles.badges, flexRow(rtl)]}>
          {item.priority ? <PriorityChip priority={item.priority} compact /> : null}
          <StatusChip status={item.status} compact />
        </View>
      </View>

      <Text style={[styles.title, textAlignStart(rtl)]} numberOfLines={2}>
        {item.title}
      </Text>

      <View style={[styles.metaRow, flexRow(rtl)]}>
        <Text style={[styles.meta, textAlignStart(rtl)]} numberOfLines={1}>
          {item.category?.name || t('home.general')}
        </Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>

      {item.address ? (
        <View style={[styles.locationRow, flexRow(rtl)]}>
          <Ionicons name="location-outline" size={14} color={Colors.gray[500]} />
          <Text style={[styles.location, textAlignStart(rtl)]} numberOfLines={1}>
            {item.address}
          </Text>
        </View>
      ) : null}

      {item.dueDate ? (
        <View style={[styles.dueRow, flexRow(rtl)]}>
          <Ionicons
            name="calendar-outline"
            size={14}
            color={item.isOverdue ? Colors.red[600] : Colors.gray[500]}
          />
          <Text style={[styles.due, item.isOverdue && styles.dueOverdue, textAlignStart(rtl)]}>
            {t('complaints.due', { date: new Date(item.dueDate).toLocaleDateString() })}
          </Text>
          {item.isOverdue ? (
            <Text style={styles.overdueTag}>{t('home.overdue')}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.footer, flexRow(rtl)]}>
        <Text style={[styles.actionText, textAlignStart(rtl), { flex: 1 }]}>{action}</Text>
        <Ionicons name={chevronForward(rtl)} size={18} color={Colors.brand[600]} />
      </View>
    </GovCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: Spacing.sm },
  topRow: { alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: Spacing.xs },
  ref: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.brand[700],
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  badges: { alignItems: 'center', gap: Spacing.xs, flexShrink: 0 },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900], marginBottom: Spacing.xs },
  metaRow: { alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  meta: { fontSize: FontSize.xs, color: Colors.gray[500] },
  metaDot: { fontSize: FontSize.xs, color: Colors.gray[400] },
  locationRow: { alignItems: 'center', gap: 4, marginTop: Spacing.xs },
  location: { flex: 1, fontSize: FontSize.xs, color: Colors.gray[600] },
  dueRow: { alignItems: 'center', gap: 4, marginTop: Spacing.xs },
  due: { fontSize: FontSize.xs, color: Colors.gray[500] },
  dueOverdue: { color: Colors.red[600], fontWeight: '600' },
  overdueTag: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.red[700],
    backgroundColor: Colors.red[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  footer: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
  actionText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[600] },
});
