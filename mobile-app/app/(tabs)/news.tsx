import { useCallback } from 'react';
import { View, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { newsApi } from '../../lib/api/endpoints';
import { getFileUrl } from '../../lib/api/client';
import { Colors } from '../../constants/theme';
import { AnnouncementCard, EmptyState, BalancedListEmpty } from '../../components/ui';
import { BrandingImages } from '../../lib/branding/assets';
import { useTranslate, useIsRtl } from '../../lib/i18n';
import { useStableRefresh } from '../../lib/ui/use-stable-refresh';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';

export default function NewsScreen() {
  const router = useRouter();
  const t = useTranslate();
  const rtl = useIsRtl();
  const { contentPaddingBottom, horizontalPadding } = useTabScreenInsets();

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
    queryKey: ['news'],
    queryFn: ({ pageParam = 1 }) => newsApi.list({ page: pageParam, limit: 20, published: true }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      if (lastPage?.meta?.hasNextPage) return (lastPage.meta.page || 1) + 1;
      return undefined;
    },
  });

  const articles = data?.pages?.flatMap((page: any) => page?.items ?? []) ?? [];
  const isEmpty = !isLoading && !isError && articles.length === 0;

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);
  const stableRefresh = useStableRefresh({ onRefresh: handleRefresh });
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={Colors.navy[700]} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={articles}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AnnouncementCard
            title={item.title}
            preview={item.content?.replace(/<[^>]*>/g, '')}
            dateLabel={new Date(item.publishedAt || item.createdAt).toLocaleDateString()}
            authorLabel={
              item.author ? `${item.author.firstName} ${item.author.lastName}` : undefined
            }
            imageUri={item.coverImageUrl ? getFileUrl(item.coverImageUrl) : undefined}
            placeholderImage={BrandingImages.announcement}
            noticeLabel={t('news.noticeBadge')}
            onPress={() => router.push(`/news/${item.id}`)}
            rtl={rtl}
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
                icon="cloud-offline-outline"
                title={t('news.errorTitle')}
                message={(error as Error)?.message || t('news.errorBody')}
                actionLabel={t('news.retry')}
                onAction={() => refetch()}
              />
            </BalancedListEmpty>
          ) : (
            <BalancedListEmpty>
              <EmptyState
                compact
                icon="newspaper-outline"
                title={t('news.empty')}
                message={t('home.news')}
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
