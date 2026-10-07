import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { flexRow, textAlignStart } from '../../lib/ui/rtl';

type DashboardEmptyBlockProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  rtl?: boolean;
};

/** Compact dashboard empty state — not the tall generic EmptyState */
export function DashboardEmptyBlock({
  title,
  message,
  actionLabel,
  onAction,
  rtl = false,
}: DashboardEmptyBlockProps) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.row, flexRow(rtl)]}>
        <View style={styles.iconWrap}>
          <Ionicons name="document-text-outline" size={22} color={Colors.navy[600]} />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.title, textAlignStart(rtl)]}>{title}</Text>
          {message ? (
            <Text style={[styles.message, textAlignStart(rtl)]} numberOfLines={2}>
              {message}
            </Text>
          ) : null}
        </View>
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={[styles.action, flexRow(rtl)]}>
          <Text style={[styles.actionText, textAlignStart(rtl)]}>{actionLabel}</Text>
          <Ionicons name="add-circle-outline" size={16} color={Colors.navy[800]} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  row: { alignItems: 'flex-start', gap: Spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.navy[900] },
  message: { fontSize: FontSize.xs, color: Colors.gray[500], lineHeight: 16 },
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[200],
  },
  actionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.navy[800],
    flex: 1,
  },
});
