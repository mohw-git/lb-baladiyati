import { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../lib/api/endpoints';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

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
    queryKey: ['notifications'],
    queryFn: ({ pageParam = 1 }) => notificationsApi.list({ page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      if (lastPage?.meta?.hasNextPage) return (lastPage.meta.page || 1) + 1;
      return undefined;
    },
  });

  const notifications = data?.pages?.flatMap((page: any) => page?.items ?? []) ?? [];

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.card, !item.isRead && styles.cardUnread]}
      onPress={() => { if (!item.isRead) markOneMutation.mutate(item.id); }}
      activeOpacity={0.7}
    >
      <View style={styles.cardRow}>
        <Ionicons
          name={item.isRead ? 'notifications-outline' : 'notifications'}
          size={20}
          color={item.isRead ? Colors.gray[400] : Colors.brand[600]}
        />
        <View style={styles.cardContent}>
          <Text style={[styles.title, !item.isRead && styles.titleUnread]} numberOfLines={2}>{item.title || 'Notification'}</Text>
          {item.body && <Text style={styles.body} numberOfLines={3}>{item.body}</Text>}
          <Text style={styles.time}>{new Date(item.createdAt).toLocaleString()}</Text>
        </View>
        {!item.isRead && <View style={styles.dot} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {notifications.length > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={() => markAllMutation.mutate()}>
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      )}
      <FlatList
        data={notifications}
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
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}><ActivityIndicator size="large" color={Colors.brand[600]} /></View>
          ) : isError ? (
            <View style={styles.empty}>
              <Ionicons name="cloud-offline-outline" size={48} color={Colors.red[400]} />
              <Text style={styles.emptyText}>Could not load notifications</Text>
              <Text style={styles.errorDetail}>{(error as any)?.message || 'Check your connection.'}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
                <Ionicons name="refresh" size={16} color={Colors.white} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color={Colors.gray[300]} />
              <Text style={styles.emptyText}>No notifications yet</Text>
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
  markAllBtn: { alignSelf: 'flex-end', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  markAllText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[600] },
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.lg,
    marginBottom: Spacing.sm, shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardUnread: { backgroundColor: Colors.brand[50], borderLeftWidth: 3, borderLeftColor: Colors.brand[600] },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  cardContent: { flex: 1 },
  title: { fontSize: FontSize.md, color: Colors.gray[700] },
  titleUnread: { fontWeight: '600', color: Colors.gray[900] },
  body: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 4, lineHeight: 20 },
  time: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.brand[600], marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.gray[400] },
  errorDetail: { fontSize: FontSize.sm, color: Colors.gray[400], textAlign: 'center', paddingHorizontal: Spacing.xl },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginTop: Spacing.sm,
  },
  retryBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.white },
});
