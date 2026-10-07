import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, BorderRadius, Spacing } from '../../constants/theme';
import { useIsRtl } from '../../lib/i18n';
import { flexRow, marginStart, textAlignStart } from '../../lib/ui/rtl';

type ErrorBannerProps = {
  title: string;
  message?: string;
  variant?: 'warning' | 'error' | 'info';
  children?: React.ReactNode;
};

export function ErrorBanner({ title, message, variant = 'warning', children }: ErrorBannerProps) {
  const rtl = useIsRtl();
  const palette = VARIANT[variant];
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <View style={[styles.row, flexRow(rtl)]}>
        <Ionicons name={palette.icon} size={22} color={palette.iconColor} />
        <View style={[styles.body, marginStart(rtl, Spacing.sm)]}>
          <Text style={[styles.title, textAlignStart(rtl)]}>{title}</Text>
          {message ? <Text style={[styles.message, textAlignStart(rtl)]}>{message}</Text> : null}
          {children}
        </View>
      </View>
    </View>
  );
}

const VARIANT = {
  warning: {
    bg: Colors.orange[50],
    border: Colors.orange[100],
    icon: 'alert-circle-outline' as const,
    iconColor: Colors.orange[700],
  },
  error: {
    bg: Colors.red[50],
    border: Colors.red[100],
    icon: 'close-circle-outline' as const,
    iconColor: Colors.red[600],
  },
  info: {
    bg: Colors.brand[50],
    border: Colors.brand[100],
    icon: 'information-circle-outline' as const,
    iconColor: Colors.brand[700],
  },
};

const styles = StyleSheet.create({
  banner: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  row: { alignItems: 'flex-start' },
  body: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700', fontSize: FontSize.sm, color: Colors.gray[900] },
  message: { fontSize: FontSize.xs, color: Colors.gray[600], marginTop: 4, lineHeight: 18 },
});
