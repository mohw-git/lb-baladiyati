import type { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Overlay } from '../../constants/theme';
import { BrandingImages } from '../../lib/branding/assets';
import { CivicBrandMark } from './civic-brand-mark';
import { LanguageSwitcher } from './language-switcher';
import { useIsRtl } from '../../lib/i18n';
import { flexRow, textAlignStart } from '../../lib/ui/rtl';

type AuthPortalLayoutProps = {
  mode: 'landing' | 'form';
  brandTitle: string;
  brandTagline: string;
  civicLine?: string;
  formSubtitle?: string;
  showBack?: boolean;
  backLabel?: string;
  children: ReactNode;
};

export function AuthPortalLayout({
  mode,
  brandTitle,
  brandTagline,
  civicLine,
  formSubtitle,
  showBack = false,
  backLabel,
  children,
}: AuthPortalLayoutProps) {
  const router = useRouter();
  const rtl = useIsRtl();
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();

  const heroMinH =
    mode === 'landing'
      ? Math.min(Math.max(windowH * 0.4, 240), 340)
      : Math.min(Math.max(windowH * 0.34, 200), 260);

  const hero = (
    <ImageBackground
      source={BrandingImages.authBg}
      style={[styles.hero, { height: heroMinH + insets.top }]}
      resizeMode="cover"
    >
      <View style={[styles.heroOverlay, { paddingTop: insets.top + 6 }]}>
        <View style={[styles.headerBar, flexRow(rtl)]}>
          {showBack ? (
            <Pressable
              onPress={() => router.replace('/(auth)/welcome')}
              style={[styles.backBtn, flexRow(rtl)]}
              hitSlop={12}
            >
              <Ionicons
                name={rtl ? 'chevron-forward' : 'chevron-back'}
                size={20}
                color={Colors.white}
              />
              {backLabel ? <Text style={styles.backText}>{backLabel}</Text> : null}
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
          <LanguageSwitcher variant="header" />
        </View>

        <View style={styles.heroBrand}>
          <CivicBrandMark size={mode === 'landing' ? 'md' : 'md'} />
          {civicLine ? (
            <Text style={[styles.portalBadge, textAlignStart(rtl)]}>{civicLine}</Text>
          ) : null}
          <Text style={[styles.brandTitle, textAlignStart(rtl)]} numberOfLines={2}>
            {brandTitle}
          </Text>
          <Text style={[styles.brandTagline, textAlignStart(rtl)]} numberOfLines={2}>
            {brandTagline}
          </Text>
          {formSubtitle ? (
            <Text style={[styles.formSubtitle, textAlignStart(rtl)]} numberOfLines={2}>
              {formSubtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.flagStripe}>
        <View style={styles.flagRed} />
        <View style={styles.flagWhite} />
        <View style={styles.flagGreen} />
      </View>
    </ImageBackground>
  );

  const panel = (
    <View
      style={[
        styles.panel,
        { paddingBottom: Math.max(insets.bottom, Spacing.lg) },
      ]}
    >
      {children}
    </View>
  );

  if (mode === 'form') {
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
          {hero}
          {panel}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.root}>
      {hero}
      <ScrollView
        style={styles.landingScroll}
        contentContainerStyle={styles.landingScrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {panel}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.navy[900] },
  scrollContent: { flexGrow: 1 },
  hero: { width: '100%' },
  heroOverlay: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    backgroundColor: Overlay.auth,
    justifyContent: 'space-between',
  },
  headerBar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 30,
  },
  headerSpacer: { width: 56 },
  backBtn: { alignItems: 'center', gap: 2, minWidth: 56 },
  backText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.white },
  heroBrand: {
    justifyContent: 'flex-end',
    gap: 4,
    paddingBottom: Spacing.xs,
  },
  portalBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
  },
  brandTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.white,
    lineHeight: 30,
  },
  brandTagline: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 20,
    fontWeight: '500',
  },
  formSubtitle: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 18,
    marginTop: 2,
  },
  flagStripe: { height: 3, flexDirection: 'row' },
  flagRed: { flex: 1, backgroundColor: '#dc2626' },
  flagWhite: { flex: 1, backgroundColor: Colors.white },
  flagGreen: { flex: 1, backgroundColor: Colors.cedar[600] },
  landingScroll: {
    flex: 1,
    marginTop: -Spacing.lg,
  },
  landingScrollContent: {
    flexGrow: 1,
  },
  panel: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.gray[200],
    shadowColor: Colors.navy[900],
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
});
