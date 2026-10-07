import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius, Shadow } from '../../constants/theme';
import { useIsRtl, useTranslate } from '../../lib/i18n';
import { textAlignStart } from '../../lib/ui/rtl';

type BrandHeaderProps = {
  subtitle?: string;
  showTagline?: boolean;
  compact?: boolean;
  centered?: boolean;
};

export function BrandHeader({
  subtitle,
  showTagline = true,
  compact,
  centered = true,
}: BrandHeaderProps) {
  const t = useTranslate();
  const rtl = useIsRtl();
  return (
    <View style={[styles.wrap, centered && styles.centered]}>
      <View style={[styles.mark, compact && styles.markCompact]}>
        <Ionicons name="business" size={compact ? 28 : 36} color={Colors.white} />
        <View style={styles.cedarStripe} />
      </View>
      <Text style={[styles.name, textAlignStart(rtl), centered && styles.textCenter]}>
        {t('welcome.brandName')}
      </Text>
      {showTagline ? (
        <Text style={[styles.tagline, textAlignStart(rtl), centered && styles.textCenter]}>
          {t('welcome.brandTagline')}
        </Text>
      ) : null}
      {subtitle ? (
        <Text style={[styles.sub, textAlignStart(rtl), centered && styles.textCenter]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.xl },
  centered: { alignItems: 'center' },
  mark: {
    width: 76,
    height: 76,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.brand[700],
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadow.md,
  },
  markCompact: { width: 64, height: 64 },
  cedarStripe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: Colors.cedar[600],
  },
  name: {
    fontSize: FontSize.xxxl,
    fontWeight: '700',
    color: Colors.navy[900],
    letterSpacing: 0.3,
  },
  tagline: {
    fontSize: FontSize.md,
    color: Colors.gray[600],
    marginTop: 4,
    fontWeight: '500',
  },
  sub: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    marginTop: Spacing.sm,
    lineHeight: 20,
    maxWidth: 320,
  },
  textCenter: { textAlign: 'center' },
});
