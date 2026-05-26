import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { GovButton } from './gov-button';
import { centeredText } from '../../lib/ui/rtl';

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Smaller padding for tab list empty states */
  compact?: boolean;
  /** Extra actions below the primary button (e.g. secondary CTA) */
  children?: ReactNode;
};

/**
 * Centered empty / locked-state card.
 * Copy is always visually centered (including Arabic) — use form rows/headers for start alignment.
 */
export function EmptyState({
  icon = 'document-text-outline',
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
  children,
}: EmptyStateProps) {
  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.iconCircle, compact && styles.iconCircleCompact]}>
        <Ionicons name={icon} size={compact ? 24 : 36} color={Colors.navy[600]} />
      </View>
      <Text style={[styles.title, compact && styles.titleCompact, centeredText]}>{title}</Text>
      {message ? (
        <Text style={[styles.message, compact && styles.messageCompact, centeredText]}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <GovButton
          label={actionLabel}
          onPress={onAction}
          variant="outline"
          style={styles.btn}
          fullWidth={false}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    maxWidth: 360,
    alignSelf: 'center',
    width: '100%',
  },
  wrapCompact: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    maxWidth: 340,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  iconCircleCompact: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.navy[900],
    alignSelf: 'stretch',
  },
  titleCompact: { fontSize: FontSize.sm },
  message: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    lineHeight: 20,
    alignSelf: 'stretch',
  },
  messageCompact: { fontSize: FontSize.xs, lineHeight: 18 },
  btn: { marginTop: Spacing.xs, alignSelf: 'center', maxWidth: 280 },
});
