import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Locale, SUPPORTED_LOCALES } from '@shared/types/locale';
import { useLocaleStore, useTranslate, useIsRtl } from '../../lib/i18n';
import { Colors, FontSize, BorderRadius, Spacing } from '../../constants/theme';
import { flexRow } from '../../lib/ui/rtl';

const LABELS: Record<Locale, string> = {
  en: 'EN',
  ar: 'ع',
  fr: 'FR',
};

type LanguageSwitcherProps = {
  /** @deprecated use variant */
  compact?: boolean;
  /** Light styling for navy hero backgrounds */
  light?: boolean;
  /** Ultra-compact segmented control for auth header bar */
  variant?: 'default' | 'compact' | 'header';
};

export function LanguageSwitcher({
  compact,
  light,
  variant: variantProp,
}: LanguageSwitcherProps) {
  const variant = variantProp ?? (compact ? 'compact' : 'default');
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = useTranslate();
  const rtl = useIsRtl();
  const onLight = light || variant === 'header';

  if (variant === 'header') {
    return (
      <View
        style={[styles.headerTrack, flexRow(rtl)]}
        accessibilityRole="tablist"
      >
        {SUPPORTED_LOCALES.map((code) => {
          const active = locale === code;
          return (
            <Pressable
              key={code}
              onPress={() => setLocale(code)}
              style={[styles.headerChip, active && styles.headerChipActive]}
              accessibilityLabel={t(`lang.${code}` as 'lang.en')}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.headerChipText, active && styles.headerChipTextActive]}>
                {LABELS[code]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {variant === 'default' ? (
        <Text
          style={[
            styles.label,
            onLight && styles.labelLight,
            { textAlign: rtl ? 'right' : 'left' },
          ]}
        >
          {t('common.language')}
        </Text>
      ) : null}
      <View style={[styles.row, flexRow(rtl)]}>
        {SUPPORTED_LOCALES.map((code) => {
          const active = locale === code;
          return (
            <Pressable
              key={code}
              onPress={() => setLocale(code)}
              style={[
                styles.chip,
                onLight && styles.chipLight,
                active && (onLight ? styles.chipActiveLight : styles.chipActive),
              ]}
              accessibilityLabel={t(`lang.${code}` as 'lang.en')}
            >
              <Text
                style={[
                  styles.chipText,
                  onLight && styles.chipTextLight,
                  active && (onLight ? styles.chipTextActiveOnLight : styles.chipTextActive),
                ]}
              >
                {LABELS[code]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  label: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.gray[500], marginBottom: 4 },
  labelLight: { color: 'rgba(255,255,255,0.85)' },
  row: { gap: Spacing.sm },
  chip: {
    minWidth: 40,
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLight: {
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: Colors.navy[700],
    borderColor: Colors.navy[700],
  },
  chipActiveLight: {
    backgroundColor: Colors.white,
    borderColor: Colors.white,
  },
  chipText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[600] },
  chipTextLight: { color: 'rgba(255,255,255,0.9)' },
  chipTextActive: { color: Colors.white },
  chipTextActiveOnLight: { color: Colors.navy[900] },
  headerTrack: {
    flexDirection: 'row',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(12, 26, 46, 0.5)',
    padding: 1,
    gap: 1,
  },
  headerChip: {
    minWidth: 28,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerChipActive: {
    backgroundColor: Colors.white,
  },
  headerChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.82)',
  },
  headerChipTextActive: {
    color: Colors.navy[900],
  },
});
