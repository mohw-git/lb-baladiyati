import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';

import { useRouter } from 'expo-router';

import { useQuery } from '@tanstack/react-query';

import { Ionicons } from '@expo/vector-icons';

import { pickName, type Locale } from '@shared/types/locale';

import { useAuthStore } from '../../lib/auth/store';


import { useLocale, useTranslate, useIsRtl } from '../../lib/i18n';

import { complaintsApi, notificationsApi } from '../../lib/api/endpoints';

import { getErrorPresentation } from '../../lib/api/errors';

import { BrandingImages } from '../../lib/branding/assets';

import {

  ScreenContainer,

  GovCard,

  GovButton,

  SectionHeader,

  StatusChip,

  EmptyState,

  ErrorBanner,

  CivicHero,

} from '../ui';

import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

import { flexRow, chevronForward, textAlignStart } from '../../lib/ui/rtl';



export function WorkerHome() {

  const router = useRouter();

  const t = useTranslate();

  const rtl = useIsRtl();

  const locale = useLocale() as Locale;

  const user = useAuthStore((s) => s.user);

  const roleLabel = t('home.worker.roleWorker');

  const { data: recentData, isLoading, isError, error, refetch, isFetching } = useQuery({

    queryKey: ['assigned-tasks', 'recent'],

    queryFn: () =>

      complaintsApi.list({ page: 1, limit: 5, myAssignments: true, openOnly: true }),

    refetchInterval: 20_000,

  });



  const { data: stats } = useQuery({

    queryKey: ['complaint-stats'],

    queryFn: () => complaintsApi.getStats(),

    refetchInterval: 30_000,

  });



  const { data: unread } = useQuery({

    queryKey: ['unread-count'],

    queryFn: () => notificationsApi.unreadCount(),

    refetchInterval: 30_000,

  });



  const byStatus = stats?.byStatus ?? {};

  const assigned = (byStatus.ASSIGNED ?? 0) + (byStatus.UNDER_REVIEW ?? 0);

  const inProgress = byStatus.IN_PROGRESS ?? 0;

  const awaiting = byStatus.PENDING_APPROVAL ?? 0;

  const overdue = stats?.overdue ?? 0;

  const deptName = pickName(user?.department ?? undefined, locale);



  return (

    <ScreenContainer onRefresh={refetch} noPadding tabSafeBottom>

      <CivicHero

        variant="worker"

        title={t('home.greeting', { name: user?.firstName ?? '' })}

        subtitle={`${roleLabel}${deptName ? ` · ${deptName}` : ''}`}

        imageSource={BrandingImages.workerBg}

        minHeight={140}

        rtl={rtl}

      />



      <View style={styles.body}>

        <GovButton

          label={t('home.worker.assignmentsCta')}

          onPress={() => router.push('/(tabs)/tasks')}

          icon="clipboard-outline"

          style={styles.primaryCta}

        />



        <View style={styles.statsGrid}>

          <View style={[styles.statsRow, flexRow(rtl)]}>

            <StatCard

              label={t('home.worker.statAssigned')}

              value={String(assigned)}

              color={Colors.orange[700]}

              icon="person-add-outline"

            />

            <StatCard

              label={t('home.worker.statInProgress')}

              value={String(inProgress)}

              color={Colors.navy[700]}

              icon="construct-outline"

            />

          </View>

          <View style={[styles.statsRow, flexRow(rtl)]}>

            <StatCard

              label={t('home.worker.statAwaiting')}

              value={String(awaiting)}

              color={Colors.gray[700]}

              icon="hourglass-outline"

            />

            <StatCard

              label={t('home.worker.statOverdue')}

              value={String(overdue)}

              color={Colors.officialRed[700]}

              icon="alert-circle-outline"

            />

          </View>

        </View>



        {(unread?.unreadCount ?? 0) > 0 ? (

          <TouchableOpacity onPress={() => router.push('/notifications')}>

            <GovCard accent="brand" style={styles.notifCard}>

              <View style={[styles.notifRow, flexRow(rtl)]}>

                <Ionicons name="notifications" size={22} color={Colors.brand[700]} />

                <Text style={[styles.notifText, { flex: 1, textAlign: rtl ? 'right' : 'left' }]}>

                  {t('home.notifications.unread', { count: unread!.unreadCount })}

                </Text>

                <Ionicons name={chevronForward(rtl)} size={18} color={Colors.brand[600]} />

              </View>

            </GovCard>

          </TouchableOpacity>

        ) : null}



        <SectionHeader

          title={t('home.worker.recent')}

          actionLabel={t('home.viewAll')}

          onAction={() => router.push('/(tabs)/tasks')}

        />



        {isError ? (

          <ErrorBanner

            title={t(getErrorPresentation(error, t).titleKey as 'errors.server.title')}

            message={getErrorPresentation(error, t).message}

            variant="error"

          />

        ) : !recentData?.items?.length ? (

          <EmptyState

            icon="construct-outline"

            title={t('tasks.empty')}

            message={t('home.worker.emptyHint')}

          />

        ) : (

          recentData.items.map((c: any) => (

            <TouchableOpacity key={c.id} onPress={() => router.push(`/complaint/${c.id}`)}>

              <GovCard

                style={[styles.listCard, c.isOverdue && styles.overdue]}

                accent={c.isOverdue ? 'warning' : 'none'}

              >

                <View style={[styles.listRow, flexRow(rtl)]}>

                  <View style={{ flex: 1, minWidth: 0 }}>

                    <Text style={[styles.listTitle, textAlignStart(rtl)]} numberOfLines={1}>

                      {c.title}

                    </Text>

                    <Text style={[styles.listMeta, textAlignStart(rtl)]} numberOfLines={2}>

                      {c.category?.name || t('home.general')}

                      {c.address ? ` · ${c.address}` : ''}

                      {c.isOverdue ? ` · ${t('home.overdue')}` : ''}

                    </Text>

                    {c.priority ? (

                      <Text style={styles.priority}>{c.priority}</Text>

                    ) : null}

                  </View>

                  <StatusChip status={c.status} compact />

                </View>

              </GovCard>

            </TouchableOpacity>

          ))

        )}

      </View>

    </ScreenContainer>

  );

}



function StatCard({

  label,

  value,

  color,

  bg,

  icon,

}: {

  label: string;

  value: string;

  color: string;

  bg?: string;

  icon: keyof typeof Ionicons.glyphMap;

}) {

  const rtl = useIsRtl();

  return (

    <View style={[styles.statCard, { backgroundColor: bg ?? Colors.white }, flexRow(rtl)]}>

      <View style={[styles.statIconWrap, { backgroundColor: `${color}14` }]}>

        <Ionicons name={icon} size={22} color={color} />

      </View>

      <View style={{ flex: 1, minWidth: 0 }}>

        <Text style={[styles.statValue, { color }]}>{value}</Text>

        <Text style={styles.statLabel} numberOfLines={2}>

          {label}

        </Text>

      </View>

    </View>

  );

}



const styles = StyleSheet.create({

  body: {

    marginTop: -Spacing.lg,

    paddingHorizontal: Spacing.xl,

    paddingBottom: Spacing.xxxxl,

  },

  primaryCta: { marginBottom: Spacing.lg },

  statsGrid: { gap: Spacing.sm, marginBottom: Spacing.lg },

  statsRow: { gap: Spacing.sm },

  statCard: {

    flex: 1,

    borderRadius: BorderRadius.md,

    padding: Spacing.md,

    alignItems: 'center',

    gap: Spacing.sm,

    minHeight: 80,

    borderWidth: 1,

    borderColor: Colors.gray[200],

  },

  statIconWrap: {

    width: 40,

    height: 40,

    borderRadius: BorderRadius.md,

    justifyContent: 'center',

    alignItems: 'center',

  },

  statValue: { fontSize: FontSize.xl, fontWeight: '700' },

  statLabel: { fontSize: FontSize.xs, color: Colors.gray[600], fontWeight: '500' },

  notifCard: { marginBottom: Spacing.lg },

  notifRow: { alignItems: 'center', gap: Spacing.sm },

  notifText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[700] },

  listCard: { marginBottom: Spacing.sm },

  overdue: { borderColor: Colors.officialRed[600] },

  listRow: { alignItems: 'center', gap: Spacing.md },

  listTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.navy[900] },

  listMeta: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2, lineHeight: 18 },

  priority: {

    fontSize: FontSize.xs,

    fontWeight: '600',

    color: Colors.orange[700],

    marginTop: 4,

    textTransform: 'uppercase',

  },

});

