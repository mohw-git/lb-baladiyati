import { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { pickName, type Locale } from '@shared/types/locale';
import { useAuthStore } from '../../lib/auth/store';
import { useLocale, useTranslate, useIsRtl } from '../../lib/i18n';
import { complaintsApi, newsApi, notificationsApi } from '../../lib/api/endpoints';
import { getErrorPresentation } from '../../lib/api/errors';
import { getCitizenSubmitPolicy } from '../../lib/citizen/submit-policy';
import {
  ScreenContainer,
  GovCard,
  GovButton,
  SectionHeader,
  StatusChip,
  ErrorBanner,
} from '../ui';
import { CitizenDashboardHeader } from './CitizenDashboardHeader';
import { CitizenCivicNotice } from './CitizenCivicNotice';
import { DashboardStatChip } from './DashboardStatChip';
import { DashboardEmptyBlock } from './DashboardEmptyBlock';
import { CitizenDashboardCivicPanels } from './CitizenDashboardCivicPanels';
import { LebanonFlagStripe } from './LebanonFlagStripe';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { flexRow, chevronForward, textAlignStart } from '../../lib/ui/rtl';

const OPEN_STATUSES = new Set([
  'SUBMITTED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'PENDING_APPROVAL',
]);
const RESOLVED_STATUSES = new Set(['COMPLETED', 'CLOSED']);

export function CitizenHome() {
  const router = useRouter();
  const navigation = useNavigation();
  const t = useTranslate();
  const rtl = useIsRtl();
  const locale = useLocale() as Locale;
  const user = useAuthStore((s) => s.user);
  const policy = getCitizenSubmitPolicy(user);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const recentQuery = useQuery({
    queryKey: ['my-complaints', 'recent'],
    queryFn: () => complaintsApi.list({ page: 1, limit: 5 }),
    refetchInterval: 20_000,
  });

  const summaryQuery = useQuery({
    queryKey: ['my-complaints', 'summary'],
    queryFn: () => complaintsApi.list({ page: 1, limit: 50 }),
    staleTime: 30_000,
  });

  const unreadQuery = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30_000,
  });

  const newsQuery = useQuery({
    queryKey: ['news', 'home-preview'],
    queryFn: () => newsApi.list({ page: 1, limit: 2, published: true }),
    staleTime: 60_000,
  });

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      recentQuery.refetch(),
      summaryQuery.refetch(),
      unreadQuery.refetch(),
      newsQuery.refetch(),
    ]);
  }, [recentQuery, summaryQuery, unreadQuery, newsQuery]);

  const { data: recentData, isLoading, isError, error } = recentQuery;
  const { data: summaryData } = summaryQuery;
  const { data: unread } = unreadQuery;
  const { data: newsData } = newsQuery;

  const items = summaryData?.items ?? [];
  const total = summaryData?.meta?.total ?? items.length;
  const openCount = items.filter((c: { status: string }) => OPEN_STATUSES.has(c.status)).length;
  const resolvedCount = items.filter((c: { status: string }) =>
    RESOLVED_STATUSES.has(c.status),
  ).length;
  const muniName = pickName(user?.municipality ?? undefined, locale);
  return (
    <ScreenContainer onRefresh={handleRefresh} noPadding tabSafeBottom>
      <View style={styles.topAnchor}>
        <CitizenDashboardHeader
          greeting={t('home.greeting', { name: user?.firstName ?? '' })}
          municipalityLine={muniName || t('home.citizen.subtitle')}
          avatarUrl={user?.avatarUrl}
          firstName={user?.firstName}
          lastName={user?.lastName}
          rtl={rtl}
        />
        <View style={styles.heroCardSpacer} />

        <View style={styles.operationsPanel}>
          <LebanonFlagStripe />
          <View style={styles.operationsBody}>
            <CitizenNotices rtl={rtl} />

          {policy.showUnverifiedWarning && !policy.blockedByVerification ? (
            <Text style={[styles.hintLine, textAlignStart(rtl)]}>{t('submit.warning.unverified')}</Text>
          ) : null}

          <GovButton
            label={t('home.citizen.submitCta')}
            onPress={() => router.push('/(tabs)/submit')}
            icon="add-circle-outline"
            style={styles.primaryCta}
          />

          <View style={[styles.statsRow, flexRow(rtl)]}>
            <DashboardStatChip
              label={t('home.citizen.statTotal')}
              value={String(total)}
              accentColor={Colors.navy[800]}
              onPress={() => router.push('/(tabs)/complaints')}
              rtl={rtl}
            />
            <DashboardStatChip
              label={t('home.citizen.statOpen')}
              value={String(openCount)}
              accentColor={Colors.orange[700]}
              onPress={() => router.push('/(tabs)/complaints')}
              rtl={rtl}
            />
            <DashboardStatChip
              label={t('home.citizen.statResolved')}
              value={String(resolvedCount)}
              accentColor={Colors.cedar[700]}
              onPress={() => router.push('/(tabs)/complaints')}
              rtl={rtl}
            />
          </View>

          {(unread?.unreadCount ?? 0) > 0 ? (
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={[styles.notifChip, flexRow(rtl)]}
            >
              <Ionicons name="notifications-outline" size={16} color={Colors.navy[700]} />
              <Text style={[styles.notifChipText, { flex: 1, textAlign: rtl ? 'right' : 'left' }]}>
                {t('home.notifications.unread', { count: unread!.unreadCount })}
              </Text>
              <Ionicons name={chevronForward(rtl)} size={14} color={Colors.gray[400]} />
            </TouchableOpacity>
          ) : null}
          </View>
        </View>
      </View>

      <View style={styles.dashboard}>
        <View style={styles.activitySection}>
          <SectionHeader
            title={t('home.citizen.recent')}
            actionLabel={t('home.viewAll')}
            onAction={() => router.push('/(tabs)/complaints')}
          />

          {isError ? (
            <ErrorBanner
              title={t(getErrorPresentation(error, t).titleKey as 'errors.server.title')}
              message={getErrorPresentation(error, t).message}
              variant="error"
            />
          ) : !recentData?.items?.length && !isLoading ? (
            <DashboardEmptyBlock
              title={t('complaints.empty')}
              message={t('home.citizen.emptyHint')}
              actionLabel={t('complaints.reportIssue')}
              onAction={() => router.push('/(tabs)/submit')}
              rtl={rtl}
            />
          ) : recentData?.items?.length ? (
            <View style={styles.listGroup}>
              {recentData.items.map((c: {
                id: string;
                title: string;
                status: string;
                createdAt: string;
                category?: { name?: string };
              }) => (
                <TouchableOpacity key={c.id} onPress={() => router.push(`/complaint/${c.id}`)}>
                  <GovCard style={styles.listCard} padded>
                    <View style={[styles.listRow, flexRow(rtl)]}>
                      <View style={styles.listText}>
                        <Text style={[styles.listTitle, textAlignStart(rtl)]} numberOfLines={1}>
                          {c.title}
                        </Text>
                        <Text style={[styles.listMeta, textAlignStart(rtl)]} numberOfLines={1}>
                          {c.category?.name || t('home.general')} ·{' '}
                          {new Date(c.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <StatusChip status={c.status} compact />
                    </View>
                  </GovCard>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>

        <CitizenDashboardCivicPanels newsItems={newsData?.items ?? []} rtl={rtl} />
      </View>
    </ScreenContainer>
  );
}

function CitizenNotices({ rtl }: { rtl: boolean }) {
  const router = useRouter();
  const t = useTranslate();
  const user = useAuthStore((s) => s.user);

  if (user?.emailVerified === false) {
    return (
      <CitizenCivicNotice
        variant="email"
        message={t('auth.unverified.body')}
        onPress={() => router.push('/(tabs)/profile')}
        rtl={rtl}
      />
    );
  }

  if (user?.verificationStatus === 'PENDING') {
    return (
      <CitizenCivicNotice variant="pending" message={t('profile.verifyPendingHint')} rtl={rtl} />
    );
  }

  if (!user?.verificationStatus || user.verificationStatus === 'UNVERIFIED') {
    return (
      <CitizenCivicNotice
        variant="kyc"
        message={t('profile.verifyMissingHint')}
        onPress={() => router.push('/kyc')}
        rtl={rtl}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  topAnchor: {
    marginBottom: Spacing.lg,
  },
  heroCardSpacer: {
    height: Spacing.sm,
  },
  dashboard: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  operationsPanel: {
    marginTop: -Spacing.lg,
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    overflow: 'hidden',
    zIndex: 2,
    shadowColor: Colors.navy[900],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  operationsBody: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  hintLine: {
    fontSize: FontSize.xs,
    color: Colors.gray[600],
    lineHeight: 16,
    marginTop: -Spacing.xs,
  },
  primaryCta: { marginTop: Spacing.xs },
  statsRow: { gap: Spacing.sm },
  notifChip: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.navy[50],
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.navy[100],
  },
  notifChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.navy[800],
  },
  activitySection: {
    gap: Spacing.sm,
  },
  listGroup: { gap: Spacing.sm },
  listCard: { marginBottom: 0 },
  listRow: { alignItems: 'center', gap: Spacing.md },
  listText: { flex: 1, minWidth: 0 },
  listTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.navy[900] },
  listMeta: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
});
