import { View, Text, StyleSheet } from 'react-native';
import { getPriorityBadge } from '../../lib/complaints/priority-config';
import { useTranslate } from '../../lib/i18n';
import { FontSize, BorderRadius, Spacing } from '../../constants/theme';

type PriorityChipProps = {
  priority: string | undefined;
  compact?: boolean;
};

export function PriorityChip({ priority, compact }: PriorityChipProps) {
  const t = useTranslate();
  const badge = getPriorityBadge(priority, t);
  return (
    <View style={[styles.chip, { backgroundColor: badge.bg }, compact && styles.compact]}>
      <Text style={[styles.label, { color: badge.color }, compact && styles.labelCompact]} numberOfLines={1}>
        {badge.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  compact: { paddingVertical: 2 },
  label: { fontSize: FontSize.xs, fontWeight: '600' },
  labelCompact: { fontSize: 10 },
});
