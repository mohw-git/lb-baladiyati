import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getComplaintStatusBadge } from '../../lib/complaints/status-config';
import { useTranslate } from '../../lib/i18n';
import { FontSize, BorderRadius, Spacing } from '../../constants/theme';

type StatusChipProps = {
  status: string | undefined;
  compact?: boolean;
};

export function StatusChip({ status, compact }: StatusChipProps) {
  const t = useTranslate();
  const badge = getComplaintStatusBadge(status, t);
  return (
    <View style={[styles.chip, { backgroundColor: badge.bg }, compact && styles.compact]}>
      {badge.icon ? (
        <Ionicons
          name={badge.icon as keyof typeof Ionicons.glyphMap}
          size={compact ? 12 : 14}
          color={badge.color}
        />
      ) : null}
      <Text style={[styles.label, { color: badge.color }, compact && styles.labelCompact]} numberOfLines={1}>
        {badge.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  compact: { paddingVertical: 2 },
  label: { fontSize: FontSize.xs, fontWeight: '600' },
  labelCompact: { fontSize: 10 },
});
