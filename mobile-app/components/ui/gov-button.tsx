import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, BorderRadius, TouchTarget, Shadow, Spacing } from '../../constants/theme';
import { useIsRtl } from '../../lib/i18n';
import { flexRow } from '../../lib/ui/rtl';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

type GovButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
  accessibilityLabel?: string;
};

export function GovButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  fullWidth = true,
  accessibilityLabel,
}: GovButtonProps) {
  const rtl = useIsRtl();
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.base,
        fullWidth && styles.full,
        v.button,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.spinner} size="small" />
      ) : (
        <View style={[styles.contentRow, flexRow(rtl)]}>
          {icon ? <Ionicons name={icon} size={20} color={v.text} /> : null}
          <Text style={[styles.label, { color: v.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<
  Variant,
  { button: ViewStyle; text: string; spinner: string }
> = {
  primary: {
    button: { backgroundColor: Colors.navy[900], ...Shadow.sm },
    text: Colors.white,
    spinner: Colors.white,
  },
  secondary: {
    button: { backgroundColor: Colors.cedar[600] },
    text: Colors.white,
    spinner: Colors.white,
  },
  outline: {
    button: {
      backgroundColor: Colors.white,
      borderWidth: 1.5,
      borderColor: Colors.brand[600],
    },
    text: Colors.brand[700],
    spinner: Colors.brand[700],
  },
  ghost: {
    button: { backgroundColor: 'transparent' },
    text: Colors.brand[700],
    spinner: Colors.brand[700],
  },
  danger: {
    button: { backgroundColor: Colors.red[600] },
    text: Colors.white,
    spinner: Colors.white,
  },
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TouchTarget.minHeight,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  full: { alignSelf: 'stretch' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88 },
  contentRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    maxWidth: '100%',
  },
  label: {
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
});
