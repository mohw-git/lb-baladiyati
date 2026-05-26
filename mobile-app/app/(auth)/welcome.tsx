import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { GovButton, AuthPortalLayout } from '../../components/ui';
import { WelcomeServiceCard } from '../../components/welcome/welcome-service-card';
import { Colors, Spacing, FontSize } from '../../constants/theme';
import { useTranslate, useIsRtl } from '../../lib/i18n';
import { flexRow, textAlignStart } from '../../lib/ui/rtl';
import { WEB_CONTACT_URL } from '../../constants/config';

export default function WelcomeScreen() {
  const router = useRouter();
  const t = useTranslate();
  const rtl = useIsRtl();

  const openContact = () => {
    void Linking.openURL(WEB_CONTACT_URL).catch(() => {});
  };

  return (
    <>
      <StatusBar style="light" />
      <AuthPortalLayout
        mode="landing"
        brandTitle={t('welcome.brandName')}
        brandTagline={t('welcome.brandTagline')}
        civicLine={t('welcome.portalLabel')}
      >
        <Text style={[styles.civicSubtitle, textAlignStart(rtl)]}>{t('welcome.subtitle')}</Text>

        <View style={styles.ctaBlock}>
          <GovButton
            label={t('welcome.login')}
            onPress={() => router.push('/(auth)/login')}
            icon="log-in-outline"
          />
          <GovButton
            label={t('welcome.createAccount')}
            onPress={() => router.push('/(auth)/register')}
            variant="outline"
            icon="person-add-outline"
          />
        </View>

        <Text style={[styles.servicesHeading, textAlignStart(rtl)]}>{t('welcome.servicesTitle')}</Text>
        <View style={styles.services}>
          <WelcomeServiceCard
            icon="clipboard-outline"
            title={t('welcome.serviceComplaints')}
            description={t('welcome.serviceComplaintsDesc')}
            rtl={rtl}
          />
          <WelcomeServiceCard
            icon="git-branch-outline"
            title={t('welcome.serviceTrack')}
            description={t('welcome.serviceTrackDesc')}
            rtl={rtl}
          />
          <WelcomeServiceCard
            icon="megaphone-outline"
            title={t('welcome.serviceNews')}
            description={t('welcome.serviceNewsDesc')}
            rtl={rtl}
          />
        </View>

        <View style={styles.footer}>
          <Pressable onPress={openContact} style={[styles.supportRow, flexRow(rtl)]}>
            <Ionicons name="help-circle-outline" size={15} color={Colors.gray[500]} />
            <Text style={styles.supportText}>{t('welcome.support')}</Text>
          </Pressable>
          <View style={[styles.trustRow, flexRow(rtl)]}>
            <Ionicons name="shield-checkmark-outline" size={13} color={Colors.cedar[600]} />
            <Text style={[styles.trustText, textAlignStart(rtl)]}>{t('welcome.footer')}</Text>
          </View>
        </View>
      </AuthPortalLayout>
    </>
  );
}

const styles = StyleSheet.create({
  civicSubtitle: {
    fontSize: FontSize.md,
    color: Colors.gray[700],
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  ctaBlock: { gap: Spacing.sm, marginBottom: Spacing.lg },
  servicesHeading: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.navy[800],
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  services: { gap: Spacing.sm, marginBottom: Spacing.lg },
  footer: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
    gap: Spacing.sm,
  },
  supportRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  supportText: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    fontWeight: '500',
  },
  trustRow: { alignItems: 'center', gap: Spacing.sm },
  trustText: {
    flex: 1,
    fontSize: 10,
    color: Colors.gray[400],
    lineHeight: 15,
  },
});
