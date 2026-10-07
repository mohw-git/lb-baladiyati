import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing } from '../../constants/theme';
import { flexRow, chevronForward, textAlignStart } from '../../lib/ui/rtl';

type InfoRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  rtl: boolean;
};

/** Profile / settings label–value row with leading icon */
export function InfoRow({ icon, label, value, rtl }: InfoRowProps) {
  return (
    <View style={[styles.infoRow, flexRow(rtl)]}>
      <View style={styles.iconSlot}>
        <Ionicons name={icon} size={18} color={Colors.gray[400]} />
      </View>
      <View style={styles.infoTextCol}>
        <Text style={[styles.infoLabel, textAlignStart(rtl)]}>{label}</Text>
        <Text style={[styles.infoValue, textAlignStart(rtl)]}>{value}</Text>
      </View>
    </View>
  );
}

type MenuRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  rtl: boolean;
  badge?: number;
  trailing?: string;
};

/** Tappable menu row with chevron on the trailing edge */
export function MenuRow({ icon, label, onPress, badge, trailing, rtl }: MenuRowProps) {
  return (
    <Pressable onPress={onPress} style={[styles.menuItem, flexRow(rtl)]}>
      <View style={styles.iconSlot}>
        <Ionicons name={icon} size={22} color={Colors.gray[600]} />
      </View>
      <Text style={[styles.menuText, textAlignStart(rtl)]}>{label}</Text>
      {badge != null && badge > 0 ? (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      {trailing ? (
        <Text style={[styles.trailing, textAlignStart(rtl)]} numberOfLines={1}>
          {trailing}
        </Text>
      ) : null}
      <Ionicons name={chevronForward(rtl)} size={18} color={Colors.gray[400]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  infoRow: {
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  iconSlot: {
    width: 24,
    alignItems: 'center',
    paddingTop: 2,
  },
  infoTextCol: { flex: 1, minWidth: 0, gap: 2 },
  infoLabel: { fontSize: FontSize.xs, color: Colors.gray[500] },
  infoValue: { fontSize: FontSize.md, color: Colors.gray[900], fontWeight: '500' },
  menuItem: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  menuText: {
    flex: 1,
    minWidth: 0,
    fontSize: FontSize.md,
    color: Colors.gray[700],
    fontWeight: '500',
  },
  trailing: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    maxWidth: 100,
  },
  unreadBadge: {
    backgroundColor: Colors.red[500],
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: Colors.white },
});
