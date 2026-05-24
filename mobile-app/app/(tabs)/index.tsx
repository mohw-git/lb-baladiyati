import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/auth/store';
import { useUserRole } from '../../lib/hooks/usePermission';
import { complaintsApi, notificationsApi } from '../../lib/api/endpoints';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  SUBMITTED: { label: 'New', color: Colors.brand[700], bg: Colors.brand[100], icon: 'paper-plane' },
  UNDER_REVIEW: { label: 'Reviewing', color: Colors.purple[700], bg: Colors.purple[100], icon: 'eye' },
  ASSIGNED: { label: 'Assigned', color: Colors.orange[700], bg: Colors.orange[100], icon: 'person-add' },
  IN_PROGRESS: { label: 'Working', color: Colors.yellow[700], bg: Colors.yellow[100], icon: 'construct' },
  PENDING_APPROVAL: { label: 'Pending', color: Colors.purple[700], bg: Colors.purple[100], icon: 'hourglass' },
  COMPLETED: { label: 'Done', color: Colors.green[700], bg: Colors.green[100], icon: 'checkmark-circle' },
  REJECTED: { label: 'Rejected', color: Colors.red[700], bg: Colors.red[100], icon: 'close-circle' },
  CLOSED: { label: 'Closed', color: Colors.gray[600], bg: Colors.gray[100], icon: 'lock-closed' },
};

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userRole = useUserRole();
  const isWorkerOrAbove = userRole === 'worker' || userRole === 'supervisor' || userRole === 'admin';

  // For citizens: recent own complaints
  // For workers: recent assigned tasks
  const { data: recentData, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: isWorkerOrAbove ? ['assigned-tasks', 'recent'] : ['my-complaints', 'recent'],
    refetchInterval: 20_000,
    queryFn: () => complaintsApi.list({ 
      page: 1, 
      limit: 5,
      myAssignments: isWorkerOrAbove ? true : undefined,
    }),
  });

  const { data: unread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 30_000,
  });

  // Stats for workers
  const { data: stats } = useQuery({
    queryKey: ['complaint-stats'],
    queryFn: () => complaintsApi.getStats(),
    enabled: isWorkerOrAbove,
  });

  const roleLabel = isWorkerOrAbove 
    ? userRole === 'supervisor' || userRole === 'admin' ? 'Supervisor' : 'Field Worker'
    : 'Citizen';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.brand[600]} />}
    >
      {/* Greeting */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.firstName}!</Text>
          <Text style={styles.subGreeting}>
            {isWorkerOrAbove ? `${roleLabel} Dashboard` : 'Report issues in your municipality'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/profile')} style={styles.avatarBtn}>
          <Text style={styles.avatarText}>
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Verified account badge for citizens */}
      {!isWorkerOrAbove && user?.verificationStatus === 'VERIFIED' && (
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: Colors.green[50],
            borderRadius: BorderRadius.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.lg,
            borderWidth: 1, borderColor: Colors.green[100],
          }}
        >
          <Ionicons name="shield-checkmark" size={24} color={Colors.green[600]} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: Colors.green[700] }}>
              Verified Account
            </Text>
            <Text style={{ fontSize: FontSize.xs, color: Colors.green[600] }}>
              Your identity has been verified. You can submit complaints.
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={20} color={Colors.green[500]} />
        </View>
      )}

      {/* KYC verification banner for citizens */}
      {!isWorkerOrAbove && user?.verificationStatus !== 'VERIFIED' && (
        <TouchableOpacity
          onPress={() => router.push('/kyc')}
          style={{
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: user?.verificationStatus === 'PENDING' ? Colors.orange[50] : Colors.red[50],
            borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg,
            borderWidth: 1,
            borderColor: user?.verificationStatus === 'PENDING' ? Colors.orange[500] : Colors.red[200],
          }}
        >
          <Ionicons
            name={user?.verificationStatus === 'PENDING' ? 'time' : 'shield-checkmark'}
            size={32}
            color={user?.verificationStatus === 'PENDING' ? Colors.orange[600] : Colors.red[600]}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontWeight: '700', fontSize: FontSize.md, color: Colors.gray[900] }}>
              {user?.verificationStatus === 'PENDING'
                ? 'Verification In Progress'
                : 'Verify Your Identity'}
            </Text>
            <Text style={{ fontSize: FontSize.sm, color: Colors.gray[600], marginTop: 2 }}>
              {user?.verificationStatus === 'PENDING'
                ? 'Your documents are being reviewed.'
                : 'Required to submit complaints and use municipal services.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={Colors.gray[400]} />
        </TouchableOpacity>
      )}

      {/* Worker stats summary */}
      {isWorkerOrAbove && stats && (
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: Colors.orange[50] }]}>
            <Text style={[styles.statNumber, { color: Colors.orange[600] }]}>
              {(stats.byStatus?.ASSIGNED || 0) + (stats.byStatus?.IN_PROGRESS || 0)}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: Colors.red[50] }]}>
            <Text style={[styles.statNumber, { color: Colors.red[600] }]}>{stats.overdue || 0}</Text>
            <Text style={styles.statLabel}>Overdue</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: Colors.green[50] }]}>
            <Text style={[styles.statNumber, { color: Colors.green[600] }]}>{stats.byStatus?.COMPLETED || 0}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>
      )}

      {/* Quick actions - different for workers vs citizens */}
      <View style={styles.actionsRow}>
        {isWorkerOrAbove ? (
          <>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: Colors.brand[600] }]} onPress={() => router.push('/(tabs)/tasks')}>
              <Ionicons name="clipboard" size={28} color={Colors.white} />
              <Text style={styles.actionLabel}>My Tasks</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: Colors.orange[500] }]} onPress={() => router.push('/(tabs)/complaints')}>
              <Ionicons name="list" size={28} color={Colors.white} />
              <Text style={styles.actionLabel}>All Issues</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: Colors.brand[600] }]} onPress={() => router.push('/(tabs)/submit')}>
              <Ionicons name="add-circle" size={28} color={Colors.white} />
              <Text style={styles.actionLabel}>Report Issue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: Colors.orange[500] }]} onPress={() => router.push('/(tabs)/complaints')}>
              <Ionicons name="list" size={28} color={Colors.white} />
              <Text style={styles.actionLabel}>My Issues</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity style={[styles.actionCard, { backgroundColor: Colors.green[500] }]} onPress={() => router.push('/(tabs)/news')}>
          <Ionicons name="newspaper" size={28} color={Colors.white} />
          <Text style={styles.actionLabel}>News</Text>
        </TouchableOpacity>
      </View>

      {/* Notification badge */}
      {(unread?.unreadCount ?? 0) > 0 && (
        <TouchableOpacity style={styles.notifBanner} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications" size={20} color={Colors.brand[700]} />
          <Text style={styles.notifText}>You have {unread?.unreadCount} unread notification{unread?.unreadCount > 1 ? 's' : ''}</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.brand[600]} />
        </TouchableOpacity>
      )}

      {/* Recent items */}
      <Text style={styles.sectionTitle}>
        {isWorkerOrAbove ? 'Recent Tasks' : 'Recent Complaints'}
      </Text>
      {isError ? (
        <View style={styles.emptyBox}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.red[400]} />
          <Text style={styles.emptyText}>Could not load data.{'\n'}Pull down to try again.</Text>
        </View>
      ) : !recentData?.items?.length ? (
        <View style={styles.emptyBox}>
          <Ionicons name="document-text-outline" size={40} color={Colors.gray[300]} />
          <Text style={styles.emptyText}>
            {isWorkerOrAbove 
              ? 'No tasks assigned yet.' 
              : 'No complaints yet.\nTap "Report Issue" to get started!'}
          </Text>
        </View>
      ) : (
        recentData.items.map((c: any) => {
          const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.SUBMITTED;
          return (
            <TouchableOpacity key={c.id} style={[styles.complaintCard, c.isOverdue && styles.complaintOverdue]} onPress={() => router.push(`/complaint/${c.id}`)}>
              <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.complaintTitle} numberOfLines={1}>{c.title}</Text>
                <Text style={styles.complaintMeta}>
                  {c.category?.name || 'General'} · {new Date(c.createdAt).toLocaleDateString()}
                  {c.isOverdue && ' · ⚠️ Overdue'}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  greeting: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.gray[900] },
  subGreeting: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 2 },
  avatarBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.brand[100],
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.brand[700] },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statBox: {
    flex: 1, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center',
  },
  statNumber: { fontSize: FontSize.xxl, fontWeight: '700' },
  statLabel: { fontSize: FontSize.xs, color: Colors.gray[600], marginTop: 2 },
  actionsRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  actionCard: {
    flex: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  actionLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.white },
  notifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.brand[50],
    borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.xl,
    borderWidth: 1, borderColor: Colors.brand[200],
  },
  notifText: { fontSize: FontSize.sm, color: Colors.brand[700], fontWeight: '500', flex: 1 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900], marginBottom: Spacing.md },
  emptyBox: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.md },
  emptyText: { fontSize: FontSize.sm, color: Colors.gray[400], textAlign: 'center', lineHeight: 20 },
  complaintCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.md,
    padding: Spacing.lg, marginBottom: Spacing.sm, gap: Spacing.md,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  complaintOverdue: {
    borderLeftWidth: 3, borderLeftColor: Colors.red[500],
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  complaintTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[900] },
  complaintMeta: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
  statusBadge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  statusText: { fontSize: FontSize.xs, fontWeight: '600' },
});
