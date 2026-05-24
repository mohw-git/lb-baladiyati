import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { transfersApi, helpRequestsApi } from '../../lib/api/endpoints';
import { useHasAnyPermission, PERMISSIONS } from '../../lib/hooks/usePermission';
import { Colors, BorderRadius, FontSize, Spacing } from '../../constants/theme';

type Channel = 'transfers' | 'help';
type InboxView = 'inbox' | 'outgoing';

/**
 * Cross-department inbox for staff in the field.
 * Two channels (Transfers / Help) × two views (Incoming / Outgoing).
 * Tap any row to open the existing detail screen for that item.
 */
export default function InboxScreen() {
  const canViewTransfers = useHasAnyPermission(PERMISSIONS.TRANSFER_VIEW);
  const canViewHelp = useHasAnyPermission(PERMISSIONS.HELP_VIEW);

  const [channel, setChannel] = useState<Channel>(canViewHelp ? 'help' : 'transfers');
  const [view, setView] = useState<InboxView>('inbox');
  const queryClient = useQueryClient();

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
    queryKey: ['helpRequests', view],
    queryFn: () => helpRequestsApi.list(params),
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
  const items = (active.data?.items ?? []) as any[];

  const onRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [channel === 'transfers' ? 'transfers' : 'helpRequests'] });
  }, [channel, queryClient]);

  if (!canViewTransfers && !canViewHelp) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.gray[400]} />
        <Text style={styles.emptyText}>Inbox is for staff with cross-department permissions.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Channel switcher */}
      <View style={styles.channelBar}>
        {canViewHelp && (
          <ChannelButton
            label="Help"
            active={channel === 'help'}
            badge={helpCount.data?.count}
            onPress={() => setChannel('help')}
          />
        )}
        {canViewTransfers && (
          <ChannelButton
            label="Transfers"
            active={channel === 'transfers'}
            badge={transfersCount.data?.count}
            onPress={() => setChannel('transfers')}
          />
        )}
      </View>

      {/* Inbox / Outgoing toggle */}
      <View style={styles.viewToggle}>
        <ViewToggleButton label="Incoming" active={view === 'inbox'} onPress={() => setView('inbox')} />
        <ViewToggleButton label="Outgoing" active={view === 'outgoing'} onPress={() => setView('outgoing')} />
      </View>

      {active.isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={Colors.brand[600]} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name={channel === 'help' ? 'hand-left-outline' : 'swap-horizontal-outline'}
            size={48}
            color={Colors.gray[400]}
          />
          <Text style={styles.emptyText}>
            {view === 'inbox'
              ? `No incoming ${channel === 'help' ? 'help requests' : 'transfers'} right now.`
              : `You haven't sent any ${channel === 'help' ? 'help requests' : 'transfers'} yet.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={active.isFetching} onRefresh={onRefresh} tintColor={Colors.brand[600]} />
          }
          renderItem={({ item }) =>
            channel === 'help' ? (
              <HelpRow item={item} />
            ) : (
              <TransferRow item={item} />
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
}: {
  label: string;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.channelButton, active && styles.channelButtonActive]}
    >
      <Text style={[styles.channelButtonText, active && styles.channelButtonTextActive]}>{label}</Text>
      {!!badge && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ViewToggleButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.viewBtn, active && styles.viewBtnActive]}>
      <Text style={[styles.viewBtnText, active && styles.viewBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function statusColor(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'PENDING':
      return { bg: Colors.yellow[50], fg: Colors.yellow[700] };
    case 'ACCEPTED':
    case 'IN_PROGRESS':
    case 'SUBMITTED':
      return { bg: Colors.blue[50], fg: Colors.blue[700] };
    case 'COMPLETED':
      return { bg: Colors.green[50], fg: Colors.green[700] };
    case 'REJECTED':
    case 'DECLINED':
      return { bg: Colors.red[50], fg: Colors.red[700] };
    case 'CANCELLED':
    case 'AUTO_CANCELLED':
      return { bg: Colors.gray[100], fg: Colors.gray[600] };
    default:
      return { bg: Colors.gray[100], fg: Colors.gray[700] };
  }
}

function TransferRow({ item }: { item: any }) {
  const tone = statusColor(item.status);
  const targetLabel = item.targetType === 'COMPLAINT' ? 'Complaint' : 'Task';
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        if (item.targetType === 'COMPLAINT' && item.targetId) {
          router.push(`/complaint/${item.targetId}`);
        }
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {targetLabel}: {item.target?.title ?? item.target?.referenceCode ?? item.targetId.slice(0, 8)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusPillText, { color: tone.fg }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.cardLine} numberOfLines={2}>
        {item.fromDepartment?.name ?? '—'} → {item.toDepartment?.name ?? '—'}
      </Text>
      {item.reason && (
        <Text style={styles.cardReason} numberOfLines={3}>
          {item.reason}
        </Text>
      )}
      <Text style={styles.cardMeta}>
        {new Date(item.createdAt).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
}

function HelpRow({ item }: { item: any }) {
  const tone = statusColor(item.status);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        if (item.complaintId) {
          router.push(`/complaint/${item.complaintId}`);
        }
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {item.complaint?.title ?? `Complaint ${item.complaintId?.slice(0, 8)}`}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusPillText, { color: tone.fg }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.cardLine} numberOfLines={2}>
        {item.fromDepartment?.name ?? '—'} → {item.toDepartment?.name ?? '—'}
      </Text>
      {item.reason && (
        <Text style={styles.cardReason} numberOfLines={3}>
          {item.reason}
        </Text>
      )}
      <Text style={styles.cardMeta}>
        {new Date(item.createdAt).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  channelBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  channelButton: {
    flexDirection: 'row',
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
    flexDirection: 'row',
    backgroundColor: Colors.gray[100],
    margin: Spacing.lg,
    padding: 4,
    borderRadius: BorderRadius.lg,
  },
  viewBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: 'center', borderRadius: BorderRadius.md },
  viewBtnActive: { backgroundColor: Colors.white, shadowColor: Colors.black, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  viewBtnText: { fontSize: FontSize.sm, color: Colors.gray[600], fontWeight: '500' },
  viewBtnTextActive: { color: Colors.gray[900], fontWeight: '700' },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },

  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.sm },
  cardTitle: { flex: 1, fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  cardLine: { marginTop: Spacing.xs, fontSize: FontSize.sm, color: Colors.gray[600] },
  cardReason: { marginTop: Spacing.sm, fontSize: FontSize.sm, color: Colors.gray[500], lineHeight: 18 },
  cardMeta: { marginTop: Spacing.sm, fontSize: FontSize.xs, color: Colors.gray[400] },

  statusPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusPillText: { fontSize: FontSize.xs, fontWeight: '700', letterSpacing: 0.3 },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
  emptyText: { textAlign: 'center', fontSize: FontSize.sm, color: Colors.gray[500], maxWidth: 280 },
});
