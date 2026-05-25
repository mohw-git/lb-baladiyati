import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { complaintsApi } from '../../lib/api/endpoints';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  SUBMITTED: { label: 'New', color: Colors.brand[700], bg: Colors.brand[100], icon: 'paper-plane' },
  UNDER_REVIEW: { label: 'Reviewing', color: Colors.purple[700], bg: Colors.purple[100], icon: 'eye' },
  ASSIGNED: { label: 'Assigned', color: Colors.orange[700], bg: Colors.orange[100], icon: 'person-add' },
  IN_PROGRESS: { label: 'Working', color: Colors.yellow[700], bg: Colors.yellow[100], icon: 'construct' },
  PENDING_APPROVAL: { label: 'Pending', color: Colors.purple[700], bg: Colors.purple[100], icon: 'hourglass' },
  COMPLETED: { label: 'Done', color: Colors.green[700], bg: Colors.green[100], icon: 'checkmark-circle' },
  REJECTED: { label: 'Rejected', color: Colors.red[700], bg: Colors.red[100], icon: 'close-circle' },
  CLOSED: { label: 'Closed', color: Colors.gray[700], bg: Colors.gray[100], icon: 'lock-closed' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  LOW: { label: 'Low', color: Colors.gray[600], bg: Colors.gray[100] },
  MEDIUM: { label: 'Medium', color: Colors.blue[600], bg: Colors.blue[100] },
  HIGH: { label: 'High', color: Colors.orange[600], bg: Colors.orange[100] },
  URGENT: { label: 'Urgent', color: Colors.red[600], bg: Colors.red[100] },
};

export default function TasksScreen() {
  const router = useRouter();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['assigned-tasks'],
    queryFn: () =>
      complaintsApi.list({ myAssignments: true, openOnly: true, limit: 50 }),
    refetchInterval: 20_000,
  });

  const renderTask = ({ item: task }: { item: any }) => {
    const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.ASSIGNED;
    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
    const isOverdue = task.isOverdue;

    return (
      <TouchableOpacity
        style={[styles.taskCard, isOverdue && styles.taskOverdue]}
        onPress={() => router.push(`/complaint/${task.id}`)}
      >
        <View style={styles.taskHeader}>
          <View style={[styles.priorityBadge, { backgroundColor: priority.bg }]}>
            <Text style={[styles.priorityText, { color: priority.color }]}>{priority.label}</Text>
          </View>
          {isOverdue && (
            <View style={styles.overdueBadge}>
              <Ionicons name="warning" size={12} color={Colors.red[600]} />
              <Text style={styles.overdueText}>Overdue</Text>
            </View>
          )}
        </View>

        <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
        
        <View style={styles.taskMeta}>
          <Text style={styles.taskRef}>{task.referenceCode}</Text>
          <Text style={styles.taskCategory}>{task.category?.name || 'General'}</Text>
        </View>

        {task.dueDate && (
          <View style={styles.dueRow}>
            <Ionicons name="calendar-outline" size={14} color={isOverdue ? Colors.red[500] : Colors.gray[500]} />
            <Text style={[styles.dueText, isOverdue && styles.dueTextOverdue]}>
              Due: {new Date(task.dueDate).toLocaleDateString()}
            </Text>
          </View>
        )}

        <View style={styles.taskFooter}>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon as any} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.gray[400]} />
        </View>
      </TouchableOpacity>
    );
  };

  const activeCount = data?.items?.filter((t: any) => 
    ['ASSIGNED', 'IN_PROGRESS'].includes(t.status)
  ).length || 0;

  const pendingCount = data?.items?.filter((t: any) => 
    t.status === 'PENDING_APPROVAL'
  ).length || 0;

  return (
    <View style={styles.container}>
      {/* Summary stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: Colors.orange[50] }]}>
          <Text style={[styles.statNumber, { color: Colors.orange[600] }]}>{activeCount}</Text>
          <Text style={styles.statLabel}>Active Tasks</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.purple[50] }]}>
          <Text style={[styles.statNumber, { color: Colors.purple[600] }]}>{pendingCount}</Text>
          <Text style={styles.statLabel}>Pending Review</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: Colors.green[50] }]}>
          <Text style={[styles.statNumber, { color: Colors.green[600] }]}>{data?.meta?.total || 0}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {isError ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.red[400]} />
          <Text style={styles.emptyTitle}>Connection Error</Text>
          <Text style={styles.emptyText}>Could not load tasks. Pull down to retry.</Text>
        </View>
      ) : !data?.items?.length && !isLoading ? (
        <View style={styles.emptyState}>
          <Ionicons name="clipboard-outline" size={48} color={Colors.gray[300]} />
          <Text style={styles.emptyTitle}>No Assigned Tasks</Text>
          <Text style={styles.emptyText}>You don't have any tasks assigned to you yet.</Text>
        </View>
      ) : (
        <FlatList
          data={data?.items || []}
          keyExtractor={(item) => item.id}
          renderItem={renderTask}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={Colors.brand[600]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[50],
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: FontSize.xs,
    color: Colors.gray[600],
    marginTop: 2,
  },
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  taskCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  taskOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.red[500],
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  priorityText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.red[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  overdueText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.red[600],
  },
  taskTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.gray[900],
    marginBottom: Spacing.xs,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  taskRef: {
    fontSize: FontSize.xs,
    color: Colors.brand[600],
    fontWeight: '500',
  },
  taskCategory: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  dueText: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
  },
  dueTextOverdue: {
    color: Colors.red[500],
    fontWeight: '500',
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[100],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.gray[700],
    marginTop: Spacing.lg,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
