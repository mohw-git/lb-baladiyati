import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { flexRow, textAlignStart } from '../../lib/ui/rtl';

type WelcomeServiceCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  rtl?: boolean;
};

/** Compact government-style service highlight for the public welcome screen */
export function WelcomeServiceCard({
  icon,
  title,
  description,
  rtl = false,
}: WelcomeServiceCardProps) {
  return (
    <View style={[styles.card, flexRow(rtl)]}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={Colors.navy[700]} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, textAlignStart(rtl)]}>{title}</Text>
        <Text style={[styles.description, textAlignStart(rtl)]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
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
  textWrap: { flex: 1, gap: 2 },
  title: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.navy[900],
    lineHeight: 20,
  },
  description: {
    fontSize: FontSize.xs,
    color: Colors.gray[600],
    lineHeight: 17,
  },
});
