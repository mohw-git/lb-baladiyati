import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, BorderRadius, Shadow, Spacing } from '../../constants/theme';

type GovCardProps = {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accent?: 'none' | 'brand' | 'cedar' | 'warning';
};

export function GovCard({
  children,
  onPress,
  style,
  padded = true,
  accent = 'none',
}: GovCardProps) {
  const content = (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        accent === 'brand' && styles.accentBrand,
        accent === 'cedar' && styles.accentCedar,
        accent === 'warning' && styles.accentWarning,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    ...Shadow.sm,
    overflow: 'hidden',
  },
  padded: { padding: Spacing.lg },
  pressed: { opacity: 0.92 },
  accentBrand: { borderLeftWidth: 4, borderLeftColor: Colors.brand[600] },
  accentCedar: { borderLeftWidth: 4, borderLeftColor: Colors.cedar[600] },
  accentWarning: { borderLeftWidth: 4, borderLeftColor: Colors.orange[500] },
});
