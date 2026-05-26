import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslate, useIsRtl } from '../../lib/i18n';
import { WEB_CONTACT_URL } from '../../constants/config';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { flexRow, textAlignStart, chevronForward } from '../../lib/ui/rtl';
import { SectionHeader } from '../ui';

type NewsItem = {
  id: string;
  title: string;
  publishedAt?: string;
  createdAt: string;
};

type CitizenDashboardCivicPanelsProps = {
  newsItems?: NewsItem[];
  rtl?: boolean;
};

/** Compact civic footer — keeps dashboard useful when complaint list is empty */
export function CitizenDashboardCivicPanels({ newsItems = [], rtl = false }: CitizenDashboardCivicPanelsProps) {
  const router = useRouter();
  const t = useTranslate();

  const openContact = () => {
    void Linking.openURL(WEB_CONTACT_URL).catch(() => {});
  };

  const quickLinks = [
    { key: 'submit', icon: 'add-circle-outline' as const, label: t('home.civic.linkSubmit'), onPress: () => router.push('/(tabs)/submit') },
    { key: 'complaints', icon: 'list-outline' as const, label: t('home.civic.linkComplaints'), onPress: () => router.push('/(tabs)/complaints') },
    { key: 'news', icon: 'newspaper-outline' as const, label: t('home.civic.linkNews'), onPress: () => router.push('/(tabs)/news') },
    { key: 'contact', icon: 'call-outline' as const, label: t('home.civic.linkContact'), onPress: openContact },
  ];

  const steps = [t('home.civic.step1'), t('home.civic.step2'), t('home.civic.step3')];

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <Text style={[styles.panelTitle, textAlignStart(rtl)]}>{t('home.civic.quickLinks')}</Text>
        <View style={[styles.quickRow, flexRow(rtl)]}>
          {quickLinks.map((link) => (
            <Pressable key={link.key} onPress={link.onPress} style={styles.quickItem}>
              <View style={styles.quickIcon}>
                <Ionicons name={link.icon} size={18} color={Colors.navy[700]} />
              </View>
              <Text style={styles.quickLabel} numberOfLines={2}>
                {link.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={[styles.panelTitle, textAlignStart(rtl)]}>{t('home.civic.howTitle')}</Text>
        {steps.map((step, index) => (
          <View key={index} style={[styles.stepRow, flexRow(rtl)]}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNum}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepText, textAlignStart(rtl)]}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <SectionHeader
          title={t('home.civic.noticesTitle')}
          actionLabel={t('home.viewAll')}
          onAction={() => router.push('/(tabs)/news')}
        />
        {newsItems.length > 0 ? (
          <View style={styles.noticeList}>
            {newsItems.slice(0, 2).map((article) => (
              <Pressable
                key={article.id}
                onPress={() => router.push(`/news/${article.id}`)}
                style={[styles.noticeRow, flexRow(rtl)]}
              >
                <Ionicons name="megaphone-outline" size={16} color={Colors.navy[600]} />
                <View style={styles.noticeTextCol}>
                  <Text style={[styles.noticeTitle, textAlignStart(rtl)]} numberOfLines={1}>
                    {article.title}
                  </Text>
                  <Text style={[styles.noticeDate, textAlignStart(rtl)]}>
                    {new Date(article.publishedAt || article.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name={chevronForward(rtl)} size={14} color={Colors.gray[400]} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={[styles.noticeEmpty, flexRow(rtl)]}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.gray[500]} />
            <Text style={[styles.noticeEmptyText, textAlignStart(rtl)]}>{t('home.civic.noticesEmpty')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  panel: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  panelTitle: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.navy[800],
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  quickRow: { gap: Spacing.sm, justifyContent: 'space-between' },
  quickItem: { flex: 1, alignItems: 'center', gap: 6, minWidth: 72 },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.gray[700],
    textAlign: 'center',
    lineHeight: 13,
  },
  stepRow: { alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: 3 },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.navy[900],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNum: { fontSize: 11, fontWeight: '700', color: Colors.white },
  stepText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.gray[700],
    lineHeight: 17,
    paddingTop: 2,
  },
  noticeList: { gap: Spacing.xs, marginTop: -Spacing.xs },
  noticeRow: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
  noticeTextCol: { flex: 1, minWidth: 0 },
  noticeTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.navy[900] },
  noticeDate: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
  noticeEmpty: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
  },
  noticeEmptyText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.gray[600],
    lineHeight: 17,
  },
});
