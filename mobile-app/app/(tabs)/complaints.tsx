import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { complaintsApi } from '../../lib/api/endpoints';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SUBMITTED: { label: 'Submitted', color: Colors.brand[700], bg: Colors.brand[100] },
  ASSIGNED: { label: 'Assigned', color: Colors.purple[700], bg: Colors.purple[100] },
  IN_PROGRESS: { label: 'In Progress', color: Colors.orange[700], bg: Colors.orange[100] },
  COMPLETED: { label: 'Completed', color: Colors.green[700], bg: Colors.green[100] },
  VERIFIED: { label: 'Verified', color: '#047857', bg: '#d1fae5' },
  REJECTED: { label: 'Rejected', color: Colors.red[700], bg: Colors.red[100] },
  CLOSED: { label: 'Closed', color: Colors.gray[600], bg: Colors.gray[100] },
};

export default function MyComplaintsScreen() {
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
    queryKey: ['my-complaints'],
    queryFn: ({ pageParam = 1 }) => complaintsApi.list({ page: pageParam, limit: 20 }),
    initialPageParam: 1,
    refetchInterval: 30_000,
    getNextPageParam: (lastPage: any) => {
      if (lastPage?.meta?.hasNextPage) return (lastPage.meta.page || 1) + 1;
      return undefined;
    },
  });

  // Flatten all pages into a single array
  const complaints = data?.pages?.flatMap((page: any) => page?.items ?? []) ?? [];

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = ({ item }: { item: any }) => {
    const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.SUBMITTED;
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/complaint/${item.id}`)} activeOpacity={0.7}>
        <View style={styles.cardTop}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <View style={styles.cardBottom}>
          <Text style={styles.meta}>{item.category?.name || 'General'}</Text>
          <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
        {item.referenceCode && <Text style={styles.refCode}>{item.referenceCode}</Text>}
      </TouchableOpacity>
    );
  };

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={Colors.brand[600]} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={complaints}
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
              <Text style={styles.emptyText}>Could not load complaints</Text>
              <Text style={styles.errorDetail}>{(error as any)?.message || 'Check your connection and try again.'}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
                <Ionicons name="refresh" size={16} color={Colors.white} />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="document-text-outline" size={48} color={Colors.gray[300]} />
              <Text style={styles.emptyText}>No complaints yet</Text>
              <TouchableOpacity style={styles.reportBtn} onPress={() => router.push('/(tabs)/submit')}>
                <Text style={styles.reportBtnText}>Report an Issue</Text>
              </TouchableOpacity>
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
    backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.lg,
    marginBottom: Spacing.sm, shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[900] },
  badge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  meta: { fontSize: FontSize.xs, color: Colors.gray[500] },
  refCode: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: Spacing.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, color: Colors.gray[400] },
  errorDetail: { fontSize: FontSize.sm, color: Colors.gray[400], textAlign: 'center', paddingHorizontal: Spacing.xl },
  reportBtn: { backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginTop: Spacing.sm },
  reportBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.white },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginTop: Spacing.sm,
  },
  retryBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.white },
  footer: { paddingVertical: Spacing.lg, alignItems: 'center' },
});
