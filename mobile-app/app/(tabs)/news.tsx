import { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { newsApi } from '../../lib/api/endpoints';
import { getFileUrl } from '../../lib/api/client';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function NewsScreen() {
  const router = useRouter();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
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

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/news/${item.id}`)} activeOpacity={0.7}>
      {item.coverImageUrl && (
        <Image source={{ uri: getFileUrl(item.coverImageUrl) }} style={styles.cover} resizeMode="cover" />
      )}
      <View style={styles.cardBody}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.preview} numberOfLines={2}>{item.content?.replace(/<[^>]*>/g, '')}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.author}>
            {item.author ? `${item.author.firstName} ${item.author.lastName}` : 'Staff'}
          </Text>
          <Text style={styles.date}>{new Date(item.publishedAt || item.createdAt).toLocaleDateString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return <View style={styles.footer}><ActivityIndicator size="small" color={Colors.brand[600]} /></View>;
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={articles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading && !isFetchingNextPage}
            onRefresh={handleRefresh}
            tintColor={Colors.brand[600]}
          />
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}><ActivityIndicator size="large" color={Colors.brand[600]} /></View>
          ) : isError ? (
            <View style={styles.empty}>
              <Ionicons name="cloud-offline-outline" size={48} color={Colors.red[400]} />
              <Text style={styles.emptyText}>Could not load news</Text>
              <Text style={styles.errorDetail}>{(error as any)?.message || 'Check your connection and try again.'}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
                <Ionicons name="refresh" size={16} color={Colors.white} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={48} color={Colors.gray[300]} />
              <Text style={styles.emptyText}>No news articles yet</Text>
            </View>
          )
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  list: { padding: Spacing.lg, paddingBottom: 20 },
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, marginBottom: Spacing.md,
    overflow: 'hidden', shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cover: { width: '100%', height: 160 },
  cardBody: { padding: Spacing.lg },
  title: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900] },
  preview: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: Spacing.xs, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  author: { fontSize: FontSize.xs, color: Colors.brand[600], fontWeight: '600' },
  date: { fontSize: FontSize.xs, color: Colors.gray[400] },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.gray[400] },
  errorDetail: { fontSize: FontSize.sm, color: Colors.gray[400], textAlign: 'center', paddingHorizontal: Spacing.xl },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginTop: Spacing.sm,
  },
  retryBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.white },
  footer: { paddingVertical: Spacing.lg, alignItems: 'center' },
});
