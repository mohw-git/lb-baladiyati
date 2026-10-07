import { useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Alert, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../lib/api/endpoints';
import { getErrorPresentation } from '../lib/api/errors';
import { resolveNotificationHref } from '../lib/push/notification-routing';
import { notificationIcon } from '../lib/notifications/notification-icons';
import { Colors, Spacing, FontSize } from '../constants/theme';
import { AuthGate } from '../components/auth-gate';
import {
  GovCard, EmptyState, LoadingState,
} from '../components/ui';
import { useTranslate, useIsRtl } from '../lib/i18n';
import { flexRow, chevronForward, textAlignStart } from '../lib/ui/rtl';
import { useStableRefresh } from '../lib/ui/use-stable-refresh';

export default function NotificationsScreen() {
  return (
    <AuthGate>
      <NotificationsContent />
    </AuthGate>
  );
}

function NotificationsContent() {
  const router = useRouter();
  const t = useTranslate();
  const rtl = useIsRtl();
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
    getNextPageParam: (lastPage: { meta?: { hasNextPage?: boolean; page?: number } }) => {
      if (lastPage?.meta?.hasNextPage) return (lastPage.meta.page || 1) + 1;
      return undefined;
    },
  });

  type NotificationRow = {
    id: string;
    type?: string;
    title?: string;
    body?: string;
    createdAt: string;
    isRead?: boolean;
    data?: Record<string, unknown>;
  };
  const notifications: NotificationRow[] =
    data?.pages?.flatMap((page: { items?: NotificationRow[] }) => page?.items ?? []) ?? [];

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

  const openNotification = useCallback(
    (item: {
      id: string;
      type?: string;
      title?: string;
      body?: string;
      data?: Record<string, unknown>;
      isRead?: boolean;
    }) => {
      if (!item.isRead) {
        markOneMutation.mutate(item.id);
      }
      const href = resolveNotificationHref({ type: item.type, data: item.data ?? null });
      if (href) {
        router.push(href);
        return;
      }
      Alert.alert(
        item.title || t('notifications.noRoute'),
        item.body || t('notifications.noRouteBody'),
        [{ text: t('common.ok') }],
      );
    },
    [markOneMutation, router, t],
  );

  const handleRefresh = useCallback(() => { refetch(); }, [refetch]);
  const stableRefresh = useStableRefresh({ onRefresh: handleRefresh });
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const errorPres = isError ? getErrorPresentation(error, t) : null;
  const hasRoute = (item: { type?: string; data?: Record<string, unknown> }) =>
    !!resolveNotificationHref({ type: item.type, data: item.data ?? null });

  const renderItem = ({ item }: { item: NotificationRow }) => {
    const unread = !item.isRead;
    const routed = hasRoute(item);
    return (
      <GovCard
        onPress={() => openNotification(item)}
        style={[styles.card, unread && styles.cardUnread]}
      >
        <View style={[styles.cardRow, flexRow(rtl)]}>
          <View style={[styles.iconWrap, unread && styles.iconWrapUnread]}>
            <Ionicons
              name={notificationIcon(item.type)}
              size={22}
              color={unread ? Colors.brand[600] : Colors.gray[500]}
            />
          </View>
          <View style={styles.cardBody}>
            <Text
              style={[styles.title, unread && styles.titleUnread, textAlignStart(rtl)]}
              numberOfLines={2}
            >
              {item.title || t('notifications.noRoute')}
            </Text>
            {item.body ? (
              <Text style={[styles.body, textAlignStart(rtl)]} numberOfLines={3}>
                {item.body}
              </Text>
            ) : null}
            <Text style={[styles.time, textAlignStart(rtl)]}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
            {routed ? (
              <Text style={[styles.hint, textAlignStart(rtl)]}>{t('notifications.targetHint')}</Text>
            ) : null}
          </View>
          {unread ? <View style={styles.dot} /> : null}
          <Ionicons name={chevronForward(rtl)} size={18} color={Colors.gray[400]} />
        </View>
      </GovCard>
    );
  };

  if (isLoading && notifications.length === 0) {
    return <LoadingState />;
  }

  return (
    <View style={styles.container}>
      {notifications.length > 0 && (
        <Pressable
          style={[styles.markAllBtn, flexRow(rtl)]}
          onPress={() => markAllMutation.mutate()}
          disabled={markAllMutation.isPending}
        >
          <Ionicons name="checkmark-done-outline" size={18} color={Colors.brand[600]} />
          <Text style={styles.markAllText}>{t('notifications.markAllRead')}</Text>
        </Pressable>
      )}
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={stableRefresh.refreshControl}
        onScroll={stableRefresh.onScroll}
        scrollEventThrottle={stableRefresh.scrollEventThrottle}
        ListEmptyComponent={
          isError && errorPres ? (
            <EmptyState
              title={t('notifications.loadError')}
              message={errorPres.message}
              actionLabel={t('common.retry')}
              onAction={() => refetch()}
            />
          ) : (
            <EmptyState
              icon="notifications-off-outline"
              title={t('notifications.empty')}
            />
          )
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoad}>
              <Text style={styles.footerText}>{t('common.loading')}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  list: { padding: Spacing.xl, paddingBottom: Spacing.xxxxl },
  markAllBtn: {
    alignSelf: 'flex-end',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  markAllText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[600] },
  card: { marginBottom: Spacing.sm },
  cardUnread: { borderWidth: 1, borderColor: Colors.brand[200], backgroundColor: Colors.brand[50] },
  cardRow: { alignItems: 'flex-start', gap: Spacing.md },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapUnread: { backgroundColor: Colors.brand[100] },
  cardBody: { flex: 1 },
  title: { fontSize: FontSize.md, color: Colors.gray[700] },
  titleUnread: { fontWeight: '700', color: Colors.gray[900] },
  body: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 4, lineHeight: 20 },
  time: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: 6 },
  hint: { fontSize: FontSize.xs, color: Colors.brand[600], marginTop: 4, fontWeight: '500' },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brand[600],
    marginTop: 8,
  },
  footerLoad: { paddingVertical: Spacing.lg, alignItems: 'center' },
  footerText: { fontSize: FontSize.sm, color: Colors.gray[500] },
});
