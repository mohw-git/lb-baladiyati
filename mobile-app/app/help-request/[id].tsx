import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { helpRequestsApi } from '../../lib/api/endpoints';
import { ApiError, getFileUrl } from '../../lib/api/client';
import { useAuthStore } from '../../lib/auth/store';
import { useHasAnyPermission, PERMISSIONS } from '../../lib/hooks/usePermission';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function HelpRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canRespond = useHasAnyPermission(PERMISSIONS.HELP_RESPOND);
  const [notes, setNotes] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['help-request', id],
    queryFn: () => helpRequestsApi.getById(id!),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['help-request', id] });
    queryClient.invalidateQueries({ queryKey: ['helpRequests'] });
    queryClient.invalidateQueries({ queryKey: ['help-requests'] });
  };

  const submitMutation = useMutation({
    mutationFn: () =>
      helpRequestsApi.submit(id!, { notes: notes.trim(), attachments: [] }),
    onSuccess: () => {
      setShowSubmit(false);
      setNotes('');
      invalidate();
      Alert.alert('Success', 'Help result submitted');
    },
    onError: (err: ApiError) => Alert.alert('Error', err.message),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.brand[600]} />
      </View>
    );
  }

  if (isError || !data) {
    const apiErr = error as ApiError | undefined;
    const is403 = apiErr?.status === 403;
    const is404 = apiErr?.status === 404;
    return (
      <View style={styles.center}>
        <Ionicons
          name={is403 ? 'lock-closed-outline' : is404 ? 'document-outline' : 'cloud-offline-outline'}
          size={48}
          color={Colors.red[400]}
        />
        <Text style={styles.emptyText}>
          {is403
            ? 'You do not have access to this help request'
            : is404
              ? 'Help request not found'
              : 'Could not load help request'}
        </Text>
        {!is403 && !is404 && apiErr?.message && (
          <Text style={styles.errorDetail}>{apiErr.message}</Text>
        )}
        {!is403 && !is404 && (
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const hr = data;
  const ctx = hr.complaintContext;
  const isAssigned = hr.helperAssigneeId === user?.id;
  const isHelperHod = user?.id && hr.toDepartment?.headUserId === user.id;
  const canSubmit =
    ['ACCEPTED', 'IN_PROGRESS'].includes(hr.status) &&
    (isAssigned || isHelperHod || canRespond);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />
      }
    >
      <Text style={styles.heading}>Cross-department Help Request</Text>
      <Text style={styles.subheading}>
        Complaint ownership remains with {hr.fromDepartment?.name ?? 'source department'}
      </Text>

      <View style={styles.badgeRow}>
        <Text style={styles.statusBadge}>{hr.status}</Text>
        <Text style={styles.deptLine}>
          {hr.fromDepartment?.name} → {hr.toDepartment?.name}
        </Text>
      </View>

      <Section title="Reason">
        <Text style={styles.body}>{hr.reason}</Text>
      </Section>

      {ctx && (
        <Section title="Complaint context">
          <Text style={styles.ref}>{ctx.referenceCode}</Text>
          <Text style={styles.title}>{ctx.title}</Text>
          <Text style={styles.body}>{ctx.description}</Text>
          {ctx.address && <Text style={styles.meta}>{ctx.address}</Text>}
          {ctx.attachments?.map((a: { id: string; url: string }) => (
            <Image
              key={a.id}
              source={{ uri: getFileUrl(a.url) }}
              style={styles.thumb}
              resizeMode="cover"
            />
          ))}
        </Section>
      )}

      {hr.solutionNotes && (
        <Section title="Help result">
          <Text style={styles.body}>{hr.solutionNotes}</Text>
        </Section>
      )}

      {hr.timeline?.length > 0 && (
        <Section title="Timeline">
          {hr.timeline.map((ev: { id: string; eventKind: string | null; notes: string | null }) => (
            <View key={ev.id} style={styles.timelineItem}>
              <Text style={styles.timelineKind}>{ev.eventKind}</Text>
              {ev.notes && <Text style={styles.meta}>{ev.notes}</Text>}
            </View>
          ))}
        </Section>
      )}

      {canSubmit && (
        <View style={styles.actions}>
          {!showSubmit ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowSubmit(true)}>
              <Text style={styles.primaryBtnText}>Submit help result</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TextInput
                style={styles.input}
                multiline
                placeholder="Describe work done (5+ characters)"
                value={notes}
                onChangeText={setNotes}
              />
              <TouchableOpacity
                style={[styles.primaryBtn, notes.trim().length < 5 && styles.disabled]}
                disabled={notes.trim().length < 5 || submitMutation.isPending}
                onPress={() => submitMutation.mutate()}
              >
                <Text style={styles.primaryBtnText}>
                  {submitMutation.isPending ? 'Submitting…' : 'Submit'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSubmit(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl * 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  heading: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray[900] },
  subheading: { marginTop: 4, fontSize: FontSize.sm, color: Colors.gray[600] },
  badgeRow: { marginTop: Spacing.md, marginBottom: Spacing.md },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.brand[100],
    color: Colors.brand[800],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    fontSize: FontSize.xs,
    fontWeight: '600',
    overflow: 'hidden',
  },
  deptLine: { marginTop: 6, fontSize: FontSize.sm, color: Colors.gray[600] },
  section: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  sectionTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[800], marginBottom: 8 },
  ref: { fontFamily: 'monospace', fontSize: FontSize.xs, color: Colors.gray[500] },
  title: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.gray[900], marginTop: 4 },
  body: { fontSize: FontSize.sm, color: Colors.gray[700], lineHeight: 20 },
  meta: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 4 },
  thumb: { width: 80, height: 80, borderRadius: BorderRadius.md, marginTop: 8 },
  timelineItem: { marginBottom: 8, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: Colors.brand[200] },
  timelineKind: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[800] },
  actions: { marginTop: Spacing.md },
  primaryBtn: {
    backgroundColor: Colors.brand[600],
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.white, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 100,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.white,
    textAlignVertical: 'top',
  },
  cancelText: { textAlign: 'center', color: Colors.gray[600], marginTop: Spacing.sm },
  emptyText: { marginTop: Spacing.md, fontSize: FontSize.md, color: Colors.gray[700], textAlign: 'center' },
  errorDetail: { marginTop: 8, fontSize: FontSize.sm, color: Colors.gray[500], textAlign: 'center' },
  retryBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.brand[600],
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  retryBtnText: { color: Colors.white, fontWeight: '600' },
});
