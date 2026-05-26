import { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { complaintsApi } from '../../lib/api/endpoints';
import { getErrorPresentation } from '../../lib/api/errors';
import { ComplaintListCard } from '../../components/complaints/ComplaintListCard';
import { EmptyState, BalancedListEmpty } from '../../components/ui';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { useTranslate, useIsRtl } from '../../lib/i18n';
import { flexRow, textAlignStart } from '../../lib/ui/rtl';
import { useStableRefresh } from '../../lib/ui/use-stable-refresh';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';

export default function TasksScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const t = useTranslate();
  const rtl = useIsRtl();
  const { contentPaddingBottom, horizontalPadding } = useTabScreenInsets();

  useEffect(() => {
    navigation.setOptions({ title: t('tasks.title') });
  }, [navigation, t]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['assigned-tasks'],
    queryFn: () =>
      complaintsApi.list({ myAssignments: true, openOnly: true, limit: 50 }),
    refetchInterval: 20_000,
  });

  const items = data?.items ?? [];
  const isEmpty = !isLoading && !isError && items.length === 0;
  const activeCount = items.filter((x: { status: string }) =>
    ['ASSIGNED', 'IN_PROGRESS'].includes(x.status),
  ).length;
  const pendingCount = items.filter((x: { status: string }) => x.status === 'PENDING_APPROVAL').length;

  const handleRefresh = useCallback(() => refetch(), [refetch]);
  const stableRefresh = useStableRefresh({ onRefresh: handleRefresh });

  const listHeader = (
    <View>
      <Text style={[styles.subtitle, textAlignStart(rtl)]}>{t('tasks.subtitle')}</Text>
      <View style={[styles.statsRow, flexRow(rtl)]}>
        <View style={[styles.statCard, { backgroundColor: Colors.orange[50] }]}>
          <Text style={[styles.statNumber, { color: Colors.orange[700] }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>{t('tasks.statActive')}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.purple[50] }]}>
          <Text style={[styles.statNumber, { color: Colors.purple[700] }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>{t('tasks.statPending')}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.brand[50] }]}>
          <Text style={[styles.statNumber, { color: Colors.brand[700] }]}>{data?.meta?.total ?? items.length}</Text>
          <Text style={styles.statLabel}>{t('tasks.statTotal')}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <ComplaintListCard
            item={item}
            onPress={() => router.push(`/complaint/${item.id}`)}
            actionLabel={t('tasks.continue')}
          />
        )}
        contentContainerStyle={[
          styles.list,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: contentPaddingBottom,
          },
          isEmpty && styles.listEmpty,
        ]}
        refreshControl={stableRefresh.refreshControl}
        onScroll={stableRefresh.onScroll}
        scrollEventThrottle={stableRefresh.scrollEventThrottle}
        ListEmptyComponent={
          isLoading ? (
            <BalancedListEmpty>
              <ActivityIndicator size="large" color={Colors.brand[600]} />
            </BalancedListEmpty>
          ) : isError ? (
            <BalancedListEmpty>
              <EmptyState
                compact
                icon={
                  getErrorPresentation(error, t).isNetwork
                    ? 'cloud-offline-outline'
                    : 'alert-circle-outline'
                }
                title={t('tasks.loadError')}
                message={getErrorPresentation(error, t).message}
                actionLabel={t('common.retry')}
                onAction={() => refetch()}
              />
            </BalancedListEmpty>
          ) : (
            <BalancedListEmpty>
              <EmptyState
                compact
                icon="clipboard-outline"
                title={t('tasks.empty')}
                message={t('tasks.emptyHint')}
              />
            </BalancedListEmpty>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  list: { paddingTop: 12, gap: 12 },
  listEmpty: { flexGrow: 1 },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  statsRow: { gap: Spacing.sm, marginBottom: Spacing.lg },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  statNumber: { fontSize: FontSize.xl, fontWeight: '700' },
  statLabel: { fontSize: FontSize.xs, color: Colors.gray[600], marginTop: 2, textAlign: 'center' },
});
