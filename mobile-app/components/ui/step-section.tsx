import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { GovCard } from './gov-card';
import { useIsRtl } from '../../lib/i18n';
import { flexRow, textAlignStart } from '../../lib/ui/rtl';

type StepSectionProps = {
  step: number;
  title: string;
  children: ReactNode;
  rtl?: boolean;
  style?: object;
};

/** Guided form section — official step-by-step complaint submission */
export function StepSection({ step, title, children, rtl: rtlProp, style }: StepSectionProps) {
  const rtlHook = useIsRtl();
  const rtl = rtlProp ?? rtlHook;

  return (
    <GovCard style={style}>
      <View style={[styles.header, flexRow(rtl)]}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{step}</Text>
        </View>
        <Text style={[styles.title, textAlignStart(rtl)]}>{title}</Text>
      </View>
      <View style={styles.body}>{children}</View>
    </GovCard>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[100],
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.navy[900],
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  title: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.navy[900],
  },
  body: {},
});
