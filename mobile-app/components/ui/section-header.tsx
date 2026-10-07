import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { useIsRtl } from '../../lib/i18n';
import { flexRow, chevronForward, textAlignStart } from '../../lib/ui/rtl';

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const rtl = useIsRtl();
  return (
    <View style={[styles.wrap, flexRow(rtl)]}>
      <Text style={[styles.title, { flex: 1 }, textAlignStart(rtl)]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={[styles.action, flexRow(rtl)]} hitSlop={8}>
          <Text style={[styles.actionText, textAlignStart(rtl)]}>{actionLabel}</Text>
          <Ionicons name={chevronForward(rtl)} size={16} color={Colors.brand[600]} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
    marginTop: 0,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.navy[900],
    letterSpacing: 0.15,
  },
  action: { alignItems: 'center', gap: 2 },
  actionText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[600] },
});
