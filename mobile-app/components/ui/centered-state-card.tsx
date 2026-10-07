import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

type CenteredStateCardProps = {
  children: ReactNode;
};

/**
 * Centered locked / verification-required panel (icon, copy, buttons).
 * All children should use centered text; RTL applies to headers/forms, not this card.
 */
export function CenteredStateCard({ children }: CenteredStateCardProps) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    padding: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
});
