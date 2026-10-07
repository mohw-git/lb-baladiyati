import { useCallback, useEffect } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, useNavigation } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { complaintsApi } from '../../lib/api/endpoints';
import { getErrorPresentation } from '../../lib/api/errors';
import { useComplaintsListConfig } from '../../lib/hooks/useComplaintsListConfig';
import { ComplaintListCard } from '../../components/complaints/ComplaintListCard';
import { EmptyState, BalancedListEmpty } from '../../components/ui';
import { Colors } from '../../constants/theme';
import { useTranslate } from '../../lib/i18n';
import { useStableRefresh } from '../../lib/ui/use-stable-refresh';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';

export default function MyComplaintsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const t = useTranslate();
  const config = useComplaintsListConfig();
  const { contentPaddingBottom, horizontalPadding } = useTabScreenInsets();

  useEffect(() => {
    navigation.setOptions({ title: t(config.titleKey) });
  }, [navigation, t, config.titleKey]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: [...config.queryKey, 'list'],
    queryFn: ({ pageParam = 1 }) =>
      complaintsApi.list({ page: pageParam, limit: 20, ...config.listParams }),
    initialPageParam: 1,
    refetchInterval: 30_000,
    getNextPageParam: (lastPage: any) => {
      if (lastPage?.meta?.hasNextPage) return (lastPage.meta.page || 1) + 1;
      return undefined;
    },
  });

  const complaints = data?.pages?.flatMap((page: any) => page?.items ?? []) ?? [];
  const isEmpty = !isLoading && !isError && complaints.length === 0;

  const handleRefresh = useCallback(() => refetch(), [refetch]);
  const stableRefresh = useStableRefresh({ onRefresh: handleRefresh });
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = () =>
    isFetchingNextPage ? (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={Colors.navy[700]} />
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        data={complaints}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ComplaintListCard
            item={item}
            onPress={() => router.push(`/complaint/${item.id}`)}
            actionLabel={
              config.mode === 'worker' ? t('tasks.continue') : t('complaints.open')
            }
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
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          isLoading ? (
            <BalancedListEmpty>
              <ActivityIndicator size="large" color={Colors.navy[700]} />
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
                title={t('complaints.loadError')}
                message={getErrorPresentation(error, t).message}
                actionLabel={t('common.retry')}
                onAction={() => refetch()}
              />
            </BalancedListEmpty>
          ) : (
            <BalancedListEmpty>
              <EmptyState
                compact
                icon="document-text-outline"
                title={t(config.emptyKey)}
                message={t(config.emptyHintKey)}
                actionLabel={config.showReportCta ? t('complaints.reportIssue') : undefined}
                onAction={
                  config.showReportCta ? () => router.push('/(tabs)/submit') : undefined
                }
              />
            </BalancedListEmpty>
          )
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  list: { paddingTop: 12, gap: 12 },
  listEmpty: { flexGrow: 1 },
  footer: { paddingVertical: 16, alignItems: 'center' },
});
