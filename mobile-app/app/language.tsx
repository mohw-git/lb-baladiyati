import { Alert, Pressable, StyleSheet, Text, View, ScrollView, I18nManager } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { useLocaleStore, useTranslate } from '../lib/i18n';
import { Locale, SUPPORTED_LOCALES, fromApiLocale, isRtl } from '@shared/types/locale';
import { authApi } from '../lib/api/endpoints';

const LANGS: { code: Locale; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'ar', label: 'Arabic', native: 'العربية' },
  { code: 'fr', label: 'French', native: 'Français' },
];

export default function LanguageScreen() {
  const router = useRouter();
  const t = useTranslate();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  // Persist the language choice to the server profile so it follows the user
  // across devices. If they're offline this still updates the local cache.
  const updateMutation = useMutation({
    mutationFn: (next: Locale) =>
      authApi.updateProfile({ locale: fromApiLocale(next) }),
    onError: () => Alert.alert(t('common.error'), t('language.saveFailed')),
  });

  const pick = async (next: Locale) => {
    if (next === locale) return;
    await setLocale(next);
    // RN requires a process restart for `I18nManager.forceRTL` changes to take
    // effect across the whole tree. We surface a hint when the direction
    // actually changes; otherwise we just apply silently.
    const willChangeDirection = isRtl(next) !== isRtl(locale);
    if (willChangeDirection) {
      // Allow RTL in case it was disabled. We do NOT force-restart the app
      // because Expo / managed workflows don't expose a reliable reload API.
      I18nManager.allowRTL(true);
    }
    updateMutation.mutate(next);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t('language.title'),
          headerBackTitle: t('common.back'),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>{t('language.subtitle')}</Text>

        <View style={styles.card}>
          {LANGS.map((lang, idx) => {
            const selected = lang.code === locale;
            return (
              <Pressable
                key={lang.code}
                onPress={() => pick(lang.code)}
                style={[
                  styles.row,
                  idx !== LANGS.length - 1 && styles.rowDivider,
                  selected && styles.rowSelected,
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.langNative, selected && styles.langNativeSelected]}>
                    {lang.native}
                  </Text>
                  <Text style={styles.langLabel}>{lang.label}</Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={22} color={Colors.brand[600]} />
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.hint}>{t('language.restartHint')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: Spacing.xl, paddingBottom: 40 },
  subtitle: { fontSize: FontSize.sm, color: Colors.gray[500], marginBottom: Spacing.lg },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.gray[200] },
  rowSelected: { backgroundColor: Colors.brand[50] },
  langNative: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[900] },
  langNativeSelected: { color: Colors.brand[700] },
  langLabel: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
  hint: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: Spacing.lg, textAlign: 'center' },
});
