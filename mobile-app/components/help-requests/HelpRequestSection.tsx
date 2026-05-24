import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { departmentsApi, helpRequestsApi } from '../../lib/api/endpoints';
import { useAuthStore } from '../../lib/auth/store';
import { useHasPermission, PERMISSIONS } from '../../lib/hooks/usePermission';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

interface Props {
  complaintId: string;
  complaintTitle: string;
  fromDepartmentId?: string | null;
  fromDepartmentName?: string | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:     { label: 'Awaiting helper',  color: Colors.yellow[700], bg: Colors.yellow[100] },
  ACCEPTED:    { label: 'Accepted',         color: Colors.blue[700],   bg: Colors.blue[100] },
  IN_PROGRESS: { label: 'Helper working',   color: Colors.blue[700],   bg: Colors.blue[100] },
  SUBMITTED:   { label: 'Awaiting review',  color: Colors.purple[700], bg: Colors.purple[100] },
  COMPLETED:   { label: 'Completed',        color: Colors.green[700],  bg: Colors.green[100] },
  DECLINED:    { label: 'Declined',         color: Colors.red[700],    bg: Colors.red[100] },
  REJECTED:    { label: 'Rejected',         color: Colors.red[700],    bg: Colors.red[100] },
  CANCELLED:   { label: 'Cancelled',        color: Colors.gray[600],   bg: Colors.gray[100] },
};

/**
 * Compact help-requests section for the mobile complaint detail screen.
 *
 * Shows the active help request (if any) and gives the right action button:
 *   - Workers / supervisors with help.request perm see "Ask another department"
 *   - The assigned helper sees "Submit helper work"
 *   - The original requester / their HOD can cancel a still-open request
 *
 * Approving/rejecting helper submissions is a HOD job → handled on the web
 * dashboard. Mobile keeps it simple.
 */
export function HelpRequestSection({
  complaintId, complaintTitle, fromDepartmentId, fromDepartmentName,
}: Props) {
  const queryClient = useQueryClient();
  const me = useAuthStore((s) => s.user) as any;
  const canRequest = useHasPermission(PERMISSIONS.HELP_REQUEST);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['help-requests', 'complaint', complaintId],
    queryFn: () => helpRequestsApi.historyForComplaint(complaintId),
    enabled: !!complaintId,
  });

  const active = useMemo(
    () => (requests as any[]).find(
      (h) => !['COMPLETED', 'DECLINED', 'REJECTED', 'CANCELLED'].includes(h.status),
    ),
    [requests],
  );

  const [showAsk, setShowAsk] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);

  const cancel = useMutation({
    mutationFn: (id: string) => helpRequestsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['help-requests', 'complaint', complaintId] });
      Alert.alert('Cancelled', 'Help request has been cancelled.');
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to cancel'),
  });

  if (isLoading) return null;

  // Empty state — only show the CTA if user can raise help requests
  if (!active && !canRequest) return null;
  if (!active) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="people" size={18} color="#b45309" />
          <Text style={styles.title}>Need help from another department?</Text>
        </View>
        <Text style={styles.body}>
          If solving this needs another department's expertise, ask them for
          help. The complaint stays with your team — they just contribute work.
        </Text>
        <TouchableOpacity
          style={styles.askBtn}
          onPress={() => setShowAsk(true)}
        >
          <Ionicons name="hand-left" size={18} color={Colors.white} />
          <Text style={styles.askBtnText}>Ask another department for help</Text>
        </TouchableOpacity>

        {showAsk && fromDepartmentId && (
          <AskHelpModal
            complaintId={complaintId}
            complaintTitle={complaintTitle}
            fromDepartmentId={fromDepartmentId}
            fromDepartmentName={fromDepartmentName ?? 'your department'}
            onClose={() => setShowAsk(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['help-requests', 'complaint', complaintId] });
              setShowAsk(false);
            }}
          />
        )}
      </View>
    );
  }

  // Active card
  const status = STATUS_LABEL[active.status] ?? STATUS_LABEL.PENDING;
  const isAssignedHelper = active.helperAssigneeId === me?.id;
  const isRequester = active.requestedById === me?.id;
  const canCancel =
    ['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(active.status) && isRequester;
  const canSubmit =
    ['ACCEPTED', 'IN_PROGRESS'].includes(active.status) && isAssignedHelper;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="people" size={18} color="#b45309" />
        <Text style={styles.title}>
          {active.fromDepartment?.name} → {active.toDepartment?.name}
        </Text>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <Text style={styles.label}>Why help is needed</Text>
      <Text style={styles.body}>{active.reason}</Text>

      {active.helperAssignee && (
        <>
          <Text style={styles.label}>Helper assigned</Text>
          <Text style={styles.body}>
            {active.helperAssignee.firstName} {active.helperAssignee.lastName}
          </Text>
        </>
      )}

      {active.solutionNotes && (
        <>
          <Text style={styles.label}>Helper's submission</Text>
          <Text style={styles.body}>{active.solutionNotes}</Text>
        </>
      )}

      <View style={styles.actions}>
        {canSubmit && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#d97706' }]}
            onPress={() => setShowSubmit(true)}
          >
            <Ionicons name="cloud-upload" size={16} color={Colors.white} />
            <Text style={styles.actionBtnText}>Submit work</Text>
          </TouchableOpacity>
        )}
        {canCancel && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.gray[100] }]}
            onPress={() =>
              Alert.alert('Cancel request?', 'This will withdraw your help request.', [
                { text: 'No', style: 'cancel' },
                { text: 'Yes, cancel', style: 'destructive', onPress: () => cancel.mutate(active.id) },
              ])
            }
          >
            <Ionicons name="close-circle" size={16} color={Colors.gray[700]} />
            <Text style={[styles.actionBtnText, { color: Colors.gray[700] }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {showSubmit && (
        <SubmitHelpModal
          requestId={active.id}
          onClose={() => setShowSubmit(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['help-requests', 'complaint', complaintId] });
            setShowSubmit(false);
          }}
        />
      )}
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function AskHelpModal({
  complaintId, complaintTitle, fromDepartmentId, fromDepartmentName, onClose, onSuccess,
}: {
  complaintId: string;
  complaintTitle: string;
  fromDepartmentId: string;
  fromDepartmentName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [toDeptId, setToDeptId] = useState('');
  const [reason, setReason] = useState('');
  const { data: deps = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  });
  const departments = (deps as any[]).filter((d: any) => d.id !== fromDepartmentId);

  const submit = useMutation({
    mutationFn: () =>
      helpRequestsApi.create(complaintId, { toDepartmentId: toDeptId, reason: reason.trim() }),
    onSuccess: () => {
      Alert.alert('Sent', 'Help request sent. The other department\'s Head will see it.');
      onSuccess();
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to send request'),
  });

  const canSubmit = !!toDeptId && reason.trim().length >= 5 && !submit.isPending;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.headerTitle}>Ask another department for help</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.gray[700]} />
          </TouchableOpacity>
        </View>
        <Text style={modalStyles.intro}>
          The complaint stays with <Text style={{ fontWeight: '700' }}>{fromDepartmentName}</Text>.
          A helper department will accept, assign someone, and submit work back
          for review.
        </Text>
        <View style={modalStyles.complaintBox}>
          <Text style={modalStyles.complaintLabel}>Complaint</Text>
          <Text style={modalStyles.complaintTitle}>{complaintTitle}</Text>
        </View>

        <Text style={modalStyles.label}>Helper department</Text>
        <View style={modalStyles.deptList}>
          {departments.map((d: any) => (
            <TouchableOpacity
              key={d.id}
              onPress={() => setToDeptId(d.id)}
              style={[
                modalStyles.deptRow,
                toDeptId === d.id && modalStyles.deptRowActive,
              ]}
            >
              <Text style={[modalStyles.deptName, toDeptId === d.id && { color: Colors.brand[700] }]}>
                {d.name}
              </Text>
              {toDeptId === d.id && (
                <Ionicons name="checkmark-circle" size={20} color={Colors.brand[600]} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={modalStyles.label}>Why do you need their help?</Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="e.g. Pothole has an exposed water pipe – Water Authority needs to fix the leak first."
          multiline
          numberOfLines={4}
          style={modalStyles.textarea}
          maxLength={1000}
        />
        <Text style={modalStyles.hint}>{reason.length}/1000 (5+ chars required)</Text>

        <TouchableOpacity
          style={[modalStyles.submitBtn, !canSubmit && { opacity: 0.5 }]}
          onPress={() => submit.mutate()}
          disabled={!canSubmit}
        >
          {submit.isPending && <ActivityIndicator color={Colors.white} />}
          <Text style={modalStyles.submitBtnText}>Send help request</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

function SubmitHelpModal({
  requestId, onClose, onSuccess,
}: {
  requestId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [notes, setNotes] = useState('');
  const submit = useMutation({
    mutationFn: () => helpRequestsApi.submit(requestId, { notes: notes.trim(), attachments: [] }),
    onSuccess: () => {
      Alert.alert('Submitted', 'Your work has been submitted for review by the original HOD.');
      onSuccess();
    },
    onError: (e: any) => Alert.alert('Error', e?.message ?? 'Failed to submit'),
  });
  const canSubmit = notes.trim().length >= 5 && !submit.isPending;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.headerTitle}>Submit helper work</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color={Colors.gray[700]} />
          </TouchableOpacity>
        </View>
        <Text style={modalStyles.intro}>
          Describe what was done. The original department's HOD reviews next.
        </Text>
        <Text style={modalStyles.label}>What did you do?</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes about the helper work (5+ chars). You can include URLs to proof photos."
          multiline
          numberOfLines={6}
          style={modalStyles.textarea}
          maxLength={2000}
        />
        <TouchableOpacity
          style={[modalStyles.submitBtn, !canSubmit && { opacity: 0.5 }]}
          onPress={() => submit.mutate()}
          disabled={!canSubmit}
        >
          {submit.isPending && <ActivityIndicator color={Colors.white} />}
          <Text style={modalStyles.submitBtnText}>Submit for review</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fffbeb', // amber-50
    borderColor: '#fde68a',     // amber-200
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginVertical: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.gray[900],
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeText: { fontSize: 11, fontWeight: '600' },
  label: {
    marginTop: Spacing.sm,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: Colors.gray[500],
    letterSpacing: 0.4,
  },
  body: { fontSize: FontSize.sm, color: Colors.gray[800], marginTop: 2 },
  askBtn: {
    marginTop: Spacing.sm,
    backgroundColor: '#d97706', // amber-600
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  askBtnText: { color: Colors.white, fontWeight: '600' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopColor: '#fde68a',
    borderTopWidth: 1,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  actionBtnText: { color: Colors.white, fontWeight: '600', fontSize: 13 },
});

const modalStyles = StyleSheet.create({
  container: { padding: Spacing.lg, paddingBottom: 80 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900], flex: 1 },
  intro: { fontSize: FontSize.sm, color: Colors.gray[600], marginBottom: Spacing.md },
  complaintBox: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  complaintLabel: {
    fontSize: 11, fontWeight: '600', color: '#b45309',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  complaintTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[900] },
  label: {
    fontSize: 12, fontWeight: '600', color: Colors.gray[700],
    marginBottom: 6, marginTop: Spacing.sm,
  },
  deptList: {
    borderColor: Colors.gray[200], borderWidth: 1, borderRadius: BorderRadius.md,
  },
  deptRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomColor: Colors.gray[100], borderBottomWidth: 1,
  },
  deptRowActive: { backgroundColor: Colors.brand[50] },
  deptName: { fontSize: FontSize.md, color: Colors.gray[900] },
  textarea: {
    borderColor: Colors.gray[200], borderWidth: 1, borderRadius: BorderRadius.md,
    padding: Spacing.sm, minHeight: 110, textAlignVertical: 'top',
    fontSize: FontSize.sm, color: Colors.gray[900],
  },
  hint: { fontSize: 11, color: Colors.gray[500], marginTop: 4 },
  submitBtn: {
    marginTop: Spacing.lg,
    backgroundColor: '#d97706',
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
});
