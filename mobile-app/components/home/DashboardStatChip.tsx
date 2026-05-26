import { Pressable, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { textAlignStart } from '../../lib/ui/rtl';

type DashboardStatChipProps = {
  label: string;
  value: string;
  accentColor: string;
  onPress: () => void;
  rtl?: boolean;
};

/** Compact operational stat for dashboard summary row */
export function DashboardStatChip({ label, value, accentColor, onPress, rtl }: DashboardStatChipProps) {
  return (
    <Pressable onPress={onPress} style={styles.chip}>
      <Text style={[styles.value, { color: accentColor }]}>{value}</Text>
      <Text style={[styles.label, textAlignStart(rtl ?? false)]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    minHeight: 52,
    justifyContent: 'center',
  },
  value: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    lineHeight: 22,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.gray[600],
    marginTop: 2,
    lineHeight: 13,
  },
});
