import { View, Text, StyleSheet, Pressable, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandingImages } from '../../lib/branding/assets';
import { Colors, FontSize, Spacing, BorderRadius, Overlay } from '../../constants/theme';
import { flexRow, textAlignStart } from '../../lib/ui/rtl';

type CitizenDashboardHeaderProps = {
  greeting: string;
  municipalityLine: string;
  initials: string;
  rtl?: boolean;
};

/** Compact citizen dashboard hero — greeting, municipality, profile access */
export function CitizenDashboardHeader({
  greeting,
  municipalityLine,
  initials,
  rtl = false,
}: CitizenDashboardHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ImageBackground
      source={BrandingImages.homeCitizenBg}
      style={styles.wrap}
      resizeMode="cover"
    >
      <View style={[styles.overlay, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={[styles.topRow, flexRow(rtl)]}>
          <View style={styles.textCol}>
            <Text style={[styles.greeting, textAlignStart(rtl)]} numberOfLines={1}>
              {greeting}
            </Text>
            <View style={[styles.muniRow, flexRow(rtl)]}>
              <Ionicons name="business-outline" size={13} color="rgba(255,255,255,0.75)" />
              <Text style={[styles.muniLine, textAlignStart(rtl)]} numberOfLines={1}>
                {municipalityLine}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.profileBtn}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            <Text style={styles.profileInitials}>{initials}</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  overlay: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    backgroundColor: Overlay.citizenHero,
    minHeight: 100,
    justifyContent: 'flex-end',
  },
  topRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  textCol: { flex: 1, minWidth: 0, gap: 4 },
  greeting: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.white,
    lineHeight: 26,
  },
  muniRow: { alignItems: 'center', gap: 6 },
  muniLine: {
    flex: 1,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.82)',
    fontWeight: '500',
  },
  profileBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
});
