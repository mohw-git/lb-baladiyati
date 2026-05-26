import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  Pressable,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { pickName } from '@shared/types/locale';
import { transfersApi, helpRequestsApi } from '../../lib/api/endpoints';
import { getErrorPresentation } from '../../lib/api/errors';
import { useHasAnyPermission, PERMISSIONS } from '../../lib/hooks/usePermission';
import { InboxListCard } from '../../components/inbox/InboxListCard';
import { EmptyState, LoadingState } from '../../components/ui';
import { Colors, BorderRadius, FontSize, Spacing } from '../../constants/theme';
import { useTranslate, useLocale, useIsRtl } from '../../lib/i18n';
import { flexRow, textAlignStart } from '../../lib/ui/rtl';
import { useStableRefresh } from '../../lib/ui/use-stable-refresh';

type Channel = 'transfers' | 'help';
type InboxView = 'inbox' | 'outgoing';

export default function InboxScreen() {
  const t = useTranslate();
  const locale = useLocale();
  const rtl = useIsRtl();
  const canViewTransfers = useHasAnyPermission(PERMISSIONS.TRANSFER_VIEW);
  const canViewHelp = useHasAnyPermission(PERMISSIONS.HELP_VIEW);

  const [channel, setChannel] = useState<Channel>(canViewHelp ? 'help' : 'transfers');
  const [view, setView] = useState<InboxView>('inbox');
  const queryClient = useQueryClient();
  const canRespondHelp = useHasAnyPermission(PERMISSIONS.HELP_RESPOND);

  const helpParams = useMemo(() => {
    if (view === 'inbox') {
      if (canRespondHelp) {
        return { queue: 'incoming' as const, limit: 50 };
      }
      return { queue: 'myAssignments' as const, limit: 50 };
    }
    return { queue: 'sourceApproval' as const, limit: 50 };
  }, [view, canRespondHelp]);

  const params = useMemo(
    () => (view === 'inbox' ? { inbox: true } : { outgoing: true }),
    [view],
  );

  const transfersQuery = useQuery({
    queryKey: ['transfers', view],
    queryFn: () => transfersApi.list(params),
    enabled: channel === 'transfers' && canViewTransfers,
  });

  const helpQuery = useQuery({
    queryKey: ['helpRequests', view, canRespondHelp],
    queryFn: async () => {
      if (canRespondHelp && view === 'inbox') {
        const [incoming, needs, inProg] = await Promise.all([
          helpRequestsApi.list({ queue: 'incoming', limit: 50 }),
          helpRequestsApi.list({ queue: 'needsAssignment', limit: 50 }),
          helpRequestsApi.list({ queue: 'inProgress', limit: 50 }),
        ]);
        const items = [...incoming.items, ...needs.items, ...inProg.items];
        return { items, total: items.length, page: 1, limit: 50, totalPages: 1 };
      }
      if (!canRespondHelp && view === 'outgoing') {
        return helpRequestsApi.list({ queue: 'sourceApproval', limit: 50 });
      }
      return helpRequestsApi.list(helpParams);
    },
    enabled: channel === 'help' && canViewHelp,
  });

  const transfersCount = useQuery({
    queryKey: ['transfers', 'pendingCount'],
    queryFn: () => transfersApi.pendingCount(),
    enabled: canViewTransfers,
    refetchInterval: 30_000,
  });

  const helpCount = useQuery({
    queryKey: ['helpRequests', 'pendingCount'],
    queryFn: () => helpRequestsApi.pendingCount(),
    enabled: canViewHelp,
    refetchInterval: 30_000,
  });

  const active = channel === 'transfers' ? transfersQuery : helpQuery;
  const items = (active.data?.items ?? []) as Record<string, unknown>[];

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: [channel === 'transfers' ? 'transfers' : 'helpRequests'],
    });
  }, [channel, queryClient]);
  const stableRefresh = useStableRefresh({ onRefresh });

  const emptyKey = useMemo(() => {
    if (channel === 'help') {
      return view === 'inbox' ? 'inbox.empty.incomingHelp' : 'inbox.empty.outgoingHelp';
    }
    return view === 'inbox' ? 'inbox.empty.incomingTransfers' : 'inbox.empty.outgoingTransfers';
  }, [channel, view]) as 'inbox.empty.incomingHelp';

  const sectionHint =
    channel === 'help'
      ? view === 'inbox'
        ? canRespondHelp
          ? t('inbox.view.incoming')
          : t('profile.myAssignments')
        : t('inbox.view.outgoing')
      : view === 'inbox'
        ? t('inbox.view.incoming')
        : t('inbox.view.outgoing');

  if (!canViewTransfers && !canViewHelp) {
    return (
      <View style={styles.noAccess}>
        <EmptyState icon="lock-closed-outline" title={t('inbox.noAccess')} />
      </View>
    );
  }

  const errorPres = active.isError ? getErrorPresentation(active.error, t) : null;

  return (
    <View style={styles.container}>
      <View style={[styles.channelBar, flexRow(rtl)]}>
        {canViewHelp && (
          <ChannelButton
            label={t('inbox.channel.help')}
            active={channel === 'help'}
            badge={
              (helpCount.data?.receiverCount ?? helpCount.data?.count ?? 0) +
              (view === 'outgoing' ? helpCount.data?.sourceCount ?? 0 : 0)
            }
            onPress={() => setChannel('help')}
            rtl={rtl}
          />
        )}
        {canViewTransfers && (
          <ChannelButton
            label={t('inbox.channel.transfers')}
            active={channel === 'transfers'}
            badge={transfersCount.data?.count}
            onPress={() => setChannel('transfers')}
            rtl={rtl}
          />
        )}
      </View>

      <View style={[styles.viewToggle, flexRow(rtl)]}>
        <ViewToggleButton
          label={t('inbox.view.incoming')}
          active={view === 'inbox'}
          onPress={() => setView('inbox')}
        />
        <ViewToggleButton
          label={t('inbox.view.outgoing')}
          active={view === 'outgoing'}
          onPress={() => setView('outgoing')}
        />
      </View>

      <Text style={[styles.sectionHint, textAlignStart(rtl)]}>{sectionHint}</Text>

      {active.isLoading ? (
        <LoadingState />
      ) : active.isError && errorPres ? (
        <EmptyState
          title={t('inbox.loadError')}
          message={errorPres.message}
          actionLabel={t('common.retry')}
          onAction={() => active.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={channel === 'help' ? 'hand-left-outline' : 'swap-horizontal-outline'}
          title={t(emptyKey)}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String((it as { id: string }).id)}
          contentContainerStyle={styles.listContent}
          refreshControl={stableRefresh.refreshControl}
          onScroll={stableRefresh.onScroll}
          scrollEventThrottle={stableRefresh.scrollEventThrottle}
          renderItem={({ item }) =>
            channel === 'help' ? (
              <HelpRow item={item} locale={locale} />
            ) : (
              <TransferRow item={item} locale={locale} />
            )
          }
        />
      )}
    </View>
  );
}

function ChannelButton({
  label,
  active,
  badge,
  onPress,
  rtl,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
  rtl: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.channelButton, active && styles.channelButtonActive, flexRow(rtl)]}
    >
      <Text style={[styles.channelButtonText, active && styles.channelButtonTextActive]}>{label}</Text>
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function ViewToggleButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.viewBtn, active && styles.viewBtnActive]}>
      <Text style={[styles.viewBtnText, active && styles.viewBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

function deptName(dept: unknown, locale: string): string {
  if (!dept || typeof dept !== 'object') return '—';
  return pickName(dept as Parameters<typeof pickName>[0], locale as 'en' | 'ar' | 'fr') || '—';
}

function HelpRow({ item, locale }: { item: Record<string, unknown>; locale: string }) {
  const complaint = item.complaint as { title?: string } | undefined;
  const title =
    complaint?.title ??
    `Complaint ${String(item.complaintId ?? '').slice(0, 8)}`;
  const routeLine = `${deptName(item.fromDepartment, locale)} → ${deptName(item.toDepartment, locale)}`;

  return (
    <InboxListCard
      title={title}
      routeLine={routeLine}
      reason={item.reason as string | undefined}
      status={String(item.status ?? 'PENDING')}
      createdAt={String(item.createdAt ?? new Date().toISOString())}
      onPress={() => {
        if (item.id) router.push(`/help-request/${item.id}`);
      }}
    />
  );
}

function TransferRow({ item, locale }: { item: Record<string, unknown>; locale: string }) {
  const t = useTranslate();
  const target = item.target as { title?: string; referenceCode?: string } | undefined;
  const targetLabel =
    item.targetType === 'COMPLAINT'
      ? t('inbox.transferTarget.complaint')
      : t('inbox.transferTarget.task');
  const title = `${targetLabel}: ${target?.title ?? target?.referenceCode ?? String(item.targetId ?? '').slice(0, 8)}`;
  const routeLine = `${deptName(item.fromDepartment, locale)} → ${deptName(item.toDepartment, locale)}`;

  return (
    <InboxListCard
      title={title}
      routeLine={routeLine}
      reason={item.reason as string | undefined}
      status={String(item.status ?? 'PENDING')}
      statusLabel={String(item.status ?? 'PENDING')}
      createdAt={String(item.createdAt ?? new Date().toISOString())}
      onPress={() => {
        if (item.targetType === 'COMPLAINT' && item.targetId) {
          router.push(`/complaint/${item.targetId}`);
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  noAccess: { flex: 1, justifyContent: 'center' },
  channelBar: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  channelButton: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.gray[200],
    gap: Spacing.sm,
  },
  channelButtonActive: {
    backgroundColor: Colors.brand[600],
    borderColor: Colors.brand[600],
  },
  channelButtonText: { color: Colors.gray[700], fontSize: FontSize.sm, fontWeight: '600' },
  channelButtonTextActive: { color: Colors.white },
  badge: {
    backgroundColor: Colors.red[500],
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    minWidth: 18,
    alignItems: 'center',
  },
  badgeText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '700' },
  viewToggle: {
    backgroundColor: Colors.gray[100],
    margin: Spacing.xl,
    padding: 4,
    borderRadius: BorderRadius.lg,
  },
  viewBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.md },
  viewBtnActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  viewBtnText: { fontSize: FontSize.sm, color: Colors.gray[600], fontWeight: '500' },
  viewBtnTextActive: { color: Colors.gray[900], fontWeight: '700' },
  sectionHint: {
    fontSize: FontSize.sm,
    color: Colors.gray[600],
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  listContent: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
});
