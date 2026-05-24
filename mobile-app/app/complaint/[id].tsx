import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, RefreshControl, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { complaintsApi } from '../../lib/api/endpoints';
import { getFileUrl } from '../../lib/api/client';
import { useCanChangeStatus, useHasPermission, PERMISSIONS } from '../../lib/hooks/usePermission';
import { useAuthStore } from '../../lib/auth/store';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { HelpRequestSection } from '../../components/help-requests/HelpRequestSection';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  SUBMITTED: { label: 'Submitted', color: Colors.brand[700], bg: Colors.brand[100], icon: 'paper-plane' },
  UNDER_REVIEW: { label: 'Under Review', color: Colors.purple[700], bg: Colors.purple[100], icon: 'eye' },
  ASSIGNED: { label: 'Assigned', color: Colors.orange[700], bg: Colors.orange[100], icon: 'person-add' },
  IN_PROGRESS: { label: 'In Progress', color: Colors.yellow[700], bg: Colors.yellow[100], icon: 'construct' },
  PENDING_APPROVAL: { label: 'Pending Approval', color: Colors.purple[700], bg: Colors.purple[100], icon: 'hourglass' },
  COMPLETED: { label: 'Completed', color: Colors.green[700], bg: Colors.green[100], icon: 'checkmark-circle' },
  REJECTED: { label: 'Rejected', color: Colors.red[700], bg: Colors.red[100], icon: 'close-circle' },
  CLOSED: { label: 'Closed', color: Colors.gray[600], bg: Colors.gray[100], icon: 'lock-closed' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  LOW: { label: 'Low Priority', color: Colors.gray[600], bg: Colors.gray[100] },
  MEDIUM: { label: 'Medium Priority', color: Colors.blue[600], bg: Colors.blue[100] },
  HIGH: { label: 'High Priority', color: Colors.orange[600], bg: Colors.orange[100] },
  URGENT: { label: 'Urgent', color: Colors.red[600], bg: Colors.red[100] },
};

export default function ComplaintDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canChangeStatus = useCanChangeStatus();
  
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [workNotes, setWorkNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');

  const { data: complaint, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintsApi.getById(id),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ status, notes, photos }: { status: string; notes?: string; photos?: string[] }) => {
      const formData = new FormData();
      formData.append('status', status);
      if (notes) formData.append('notes', notes);
      
      if (photos?.length) {
        photos.forEach((uri, index) => {
          const filename = uri.split('/').pop() || `photo_${index}.jpg`;
          const match = /\.(\w+)$/.exec(filename);
          const type = match ? `image/${match[1]}` : 'image/jpeg';
          formData.append('attachments', { uri, name: filename, type } as any);
        });
      }
      
      return complaintsApi.changeStatus(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      queryClient.invalidateQueries({ queryKey: ['assigned-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
      setShowProofModal(false);
      setProofPhotos([]);
      setWorkNotes('');
      Alert.alert('Success', 'Status updated successfully');
    },
    onError: (err: any) => {
      Alert.alert('Error', err.message || 'Failed to update status');
    },
  });

  const handleStartWork = () => {
    Alert.alert(
      'Start Work',
      'Are you ready to start working on this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => statusMutation.mutate({ status: 'IN_PROGRESS' }) },
      ]
    );
  };

  const handleSubmitForApproval = () => {
    setShowProofModal(true);
  };

  const pickProofPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5,
    });
    
    if (!result.canceled && result.assets?.length) {
      setProofPhotos([...proofPhotos, ...result.assets.map((a) => a.uri)].slice(0, 5));
    }
  };

  const takeProofPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Camera permission is required');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets?.[0]) {
      setProofPhotos([...proofPhotos, result.assets[0].uri].slice(0, 5));
    }
  };

  const submitProof = () => {
    if (!proofPhotos.length) {
      Alert.alert('Photos Required', 'Please add at least one photo as proof of work completion');
      return;
    }
    statusMutation.mutate({ status: 'PENDING_APPROVAL', notes: workNotes, photos: proofPhotos });
  };

  const feedbackMutation = useMutation({
    mutationFn: () => complaintsApi.submitFeedback(id, { rating: feedbackRating, comment: feedbackComment || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaint', id] });
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
      setShowFeedbackModal(false);
      setFeedbackRating(0);
      setFeedbackComment('');
      Alert.alert('Thank You', 'Your feedback has been submitted.');
    },
    onError: (err: any) => {
      Alert.alert('Error', err?.message || 'Failed to submit feedback');
    },
  });

  const submitFeedback = () => {
    if (feedbackRating < 1 || feedbackRating > 5) {
      Alert.alert('Rating Required', 'Please select a rating from 1 to 5 stars');
      return;
    }
    feedbackMutation.mutate();
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.brand[600]} /></View>;
  }

  if (isError || !complaint) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={48} color={Colors.red[400]} />
        <Text style={styles.emptyText}>
          {isError ? 'Could not load complaint' : 'Complaint not found'}
        </Text>
        {isError && (
          <Text style={styles.errorDetail}>{(error as any)?.message || 'Check your connection.'}</Text>
        )}
        <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
          <Ionicons name="refresh" size={16} color={Colors.white} />
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cfg = STATUS_CONFIG[complaint.status] || STATUS_CONFIG.SUBMITTED;
  const priorityCfg = PRIORITY_CONFIG[complaint.priority] || PRIORITY_CONFIG.MEDIUM;
  const isAssignedToMe = complaint.currentAssignment?.assignedTo?.id === user?.id;
  const showWorkerActions = canChangeStatus && isAssignedToMe;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Colors.brand[600]} />}
      >
        {/* Status + Priority badges */}
        <View style={styles.badgesRow}>
          <View style={[styles.statusBanner, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
            <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          {complaint.priority && (
            <View style={[styles.statusBanner, { backgroundColor: priorityCfg.bg }]}>
              <Ionicons name="flag" size={14} color={priorityCfg.color} />
              <Text style={[styles.statusLabel, { color: priorityCfg.color }]}>{priorityCfg.label}</Text>
            </View>
          )}
        </View>

        {/* Overdue warning */}
        {complaint.isOverdue && (
          <View style={styles.overdueWarning}>
            <Ionicons name="warning" size={18} color={Colors.red[600]} />
            <Text style={styles.overdueText}>This task is overdue!</Text>
          </View>
        )}

        {/* SLA / Due date */}
        {complaint.dueDate && (
          <View style={[styles.dueBox, complaint.isOverdue && styles.dueBoxOverdue]}>
            <Ionicons name="time-outline" size={16} color={complaint.isOverdue ? Colors.red[600] : Colors.gray[600]} />
            <Text style={[styles.dueText, complaint.isOverdue && { color: Colors.red[600] }]}>
              Due: {new Date(complaint.dueDate).toLocaleString()}
            </Text>
          </View>
        )}

        <Text style={styles.title}>{complaint.title}</Text>
        {complaint.referenceCode && <Text style={styles.ref}>{complaint.referenceCode}</Text>}

        {/* Worker Action buttons */}
        {showWorkerActions && (
          <View style={styles.actionsCard}>
            {complaint.status === 'ASSIGNED' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.brand[600] }]}
                onPress={handleStartWork}
                disabled={statusMutation.isPending}
              >
                <Ionicons name="play" size={20} color={Colors.white} />
                <Text style={styles.actionBtnText}>Start Work</Text>
              </TouchableOpacity>
            )}
            {complaint.status === 'IN_PROGRESS' && (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.green[600] }]}
                onPress={handleSubmitForApproval}
                disabled={statusMutation.isPending}
              >
                <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
                <Text style={styles.actionBtnText}>Submit for Approval</Text>
              </TouchableOpacity>
            )}
            {statusMutation.isPending && (
              <ActivityIndicator style={{ marginTop: Spacing.sm }} color={Colors.brand[600]} />
            )}
          </View>
        )}

        {/* Cross-department help requests */}
        <HelpRequestSection
          complaintId={String(id)}
          complaintTitle={complaint.title}
          fromDepartmentId={complaint.department?.id ?? null}
          fromDepartmentName={complaint.department?.name ?? null}
        />

        {/* Rejection info */}
        {complaint.status === 'REJECTED' && complaint.rejectionReason && (
          <View style={styles.rejectionCard}>
            <View style={styles.rejectionHeader}>
              <Ionicons name="close-circle" size={20} color={Colors.red[600]} />
              <Text style={styles.rejectionTitle}>Complaint Rejected</Text>
            </View>
            <Text style={styles.rejectionReason}>{complaint.rejectionReason.replace(/_/g, ' ')}</Text>
            {complaint.rejectionNotes && (
              <Text style={styles.rejectionNotes}>{complaint.rejectionNotes}</Text>
            )}
          </View>
        )}

        {/* Feedback section - shown to citizen owner when complaint is COMPLETED/CLOSED */}
        {(complaint.status === 'COMPLETED' || complaint.status === 'CLOSED') &&
          complaint.createdBy?.id === user?.id && (
            complaint.feedback ? (
              <View style={[styles.card, { borderColor: Colors.green[100], borderWidth: 1, backgroundColor: Colors.green[50] }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.green[600]} />
                  <Text style={[styles.sectionTitle, { color: Colors.green[700], marginBottom: 0 }]}>
                    Your Feedback
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={s <= complaint.feedback.rating ? 'star' : 'star-outline'}
                      size={20}
                      color={Colors.yellow[600]}
                    />
                  ))}
                </View>
                {complaint.feedback.comment && (
                  <Text style={{ fontSize: FontSize.sm, color: Colors.gray[700] }}>
                    "{complaint.feedback.comment}"
                  </Text>
                )}
              </View>
            ) : (
              <View style={[styles.card, { borderColor: Colors.brand[200], borderWidth: 1 }]}>
                <Text style={[styles.sectionTitle, { color: Colors.brand[700] }]}>
                  How was your experience?
                </Text>
                <Text style={{ fontSize: FontSize.sm, color: Colors.gray[600], marginBottom: 12 }}>
                  Rate the service quality to help your municipality improve.
                </Text>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.brand[600] }]}
                  onPress={() => setShowFeedbackModal(true)}
                >
                  <Ionicons name="star" size={20} color={Colors.white} />
                  <Text style={styles.actionBtnText}>Rate This Resolution</Text>
                </TouchableOpacity>
              </View>
            )
          )}

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{complaint.description}</Text>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow icon="pricetag" label="Category" value={complaint.category?.name || '—'} />
          {complaint.department && <DetailRow icon="business" label="Department" value={complaint.department.name} />}
          {complaint.address && <DetailRow icon="location" label="Address" value={complaint.address} />}
          {complaint.latitude && complaint.longitude && (
            <DetailRow icon="navigate" label="Coordinates" value={`${parseFloat(complaint.latitude).toFixed(6)}, ${parseFloat(complaint.longitude).toFixed(6)}`} />
          )}
          <DetailRow icon="calendar" label="Submitted" value={new Date(complaint.createdAt).toLocaleString()} />
          {complaint.resolvedAt && (
            <DetailRow icon="checkmark-done" label="Resolved" value={new Date(complaint.resolvedAt).toLocaleString()} />
          )}
        </View>

        {/* Attachments by stage */}
        {complaint.attachments?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Photos</Text>
            {/* Submission photos */}
            {complaint.attachments.filter((a: any) => a.stage === 'SUBMISSION').length > 0 && (
              <>
                <Text style={styles.photoStageLabel}>Original Report</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                  {complaint.attachments.filter((a: any) => a.stage === 'SUBMISSION').map((a: any) => (
                    <Image key={a.id} source={{ uri: getFileUrl(a.url) }} style={styles.photo} resizeMode="cover" />
                  ))}
                </ScrollView>
              </>
            )}
            {/* Proof photos */}
            {complaint.attachments.filter((a: any) => a.stage === 'PROOF').length > 0 && (
              <>
                <Text style={[styles.photoStageLabel, { marginTop: Spacing.md }]}>Work Completion Proof</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                  {complaint.attachments.filter((a: any) => a.stage === 'PROOF').map((a: any) => (
                    <Image key={a.id} source={{ uri: getFileUrl(a.url) }} style={styles.photo} resizeMode="cover" />
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        )}

        {/* Current Assignment */}
        {complaint.currentAssignment && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Assigned To</Text>
            <View style={styles.assignRow}>
              <View style={styles.assignAvatar}>
                <Text style={styles.assignAvatarText}>
                  {complaint.currentAssignment.assignedTo?.firstName?.[0]}
                  {complaint.currentAssignment.assignedTo?.lastName?.[0]}
                </Text>
              </View>
              <View>
                <Text style={styles.assignName}>
                  {complaint.currentAssignment.assignedTo?.firstName} {complaint.currentAssignment.assignedTo?.lastName}
                </Text>
                <Text style={styles.assignMeta}>
                  Assigned by {complaint.currentAssignment.assignedBy?.firstName} {complaint.currentAssignment.assignedBy?.lastName}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Feedback */}
        {complaint.feedback && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Citizen Feedback</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= complaint.feedback.rating ? 'star' : 'star-outline'}
                  size={24}
                  color={Colors.yellow[500]}
                />
              ))}
              <Text style={styles.ratingText}>{complaint.feedback.rating}/5</Text>
            </View>
            {complaint.feedback.comment && (
              <Text style={styles.feedbackComment}>"{complaint.feedback.comment}"</Text>
            )}
          </View>
        )}

        {/* Status timeline */}
        {complaint.statusHistory?.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Status History</Text>
            {complaint.statusHistory.map((log: any, i: number) => {
              const logCfg = STATUS_CONFIG[log.toStatus] || STATUS_CONFIG.SUBMITTED;
              return (
                <View key={log.id} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                    <View style={[styles.timelineDot, { backgroundColor: logCfg.color }]} />
                    {i < complaint.statusHistory.length - 1 && <View style={styles.timelineConnector} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineStatus}>{logCfg.label}</Text>
                    {log.notes && <Text style={styles.timelineNotes}>{log.notes}</Text>}
                    <Text style={styles.timelineDate}>
                      {log.changedBy ? `${log.changedBy.firstName} ${log.changedBy.lastName} · ` : ''}
                      {new Date(log.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Proof upload modal */}
      <Modal visible={showProofModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProofModal(false)}>
              <Ionicons name="close" size={24} color={Colors.gray[900]} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Submit for Approval</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalSectionTitle}>Proof Photos *</Text>
            <Text style={styles.modalHint}>Add at least one photo showing the completed work</Text>

            <View style={styles.photoGrid}>
              {proofPhotos.map((uri, idx) => (
                <View key={idx} style={styles.proofPhotoContainer}>
                  <Image source={{ uri }} style={styles.proofPhoto} />
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => setProofPhotos(proofPhotos.filter((_, i) => i !== idx))}
                  >
                    <Ionicons name="close-circle" size={24} color={Colors.red[500]} />
                  </TouchableOpacity>
                </View>
              ))}
              {proofPhotos.length < 5 && (
                <View style={styles.addPhotoButtons}>
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={takeProofPhoto}>
                    <Ionicons name="camera" size={28} color={Colors.brand[600]} />
                    <Text style={styles.addPhotoLabel}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={pickProofPhoto}>
                    <Ionicons name="images" size={28} color={Colors.brand[600]} />
                    <Text style={styles.addPhotoLabel}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={[styles.modalSectionTitle, { marginTop: Spacing.xl }]}>Work Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add any notes about the work done..."
              value={workNotes}
              onChangeText={setWorkNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.submitBtn, (!proofPhotos.length || statusMutation.isPending) && styles.submitBtnDisabled]}
              onPress={submitProof}
              disabled={!proofPhotos.length || statusMutation.isPending}
            >
              {statusMutation.isPending ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={20} color={Colors.white} />
                  <Text style={styles.submitBtnText}>Submit for Approval</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal visible={showFeedbackModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rate Your Experience</Text>
            <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
              <Ionicons name="close" size={28} color={Colors.gray[600]} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
            <Text style={{ fontSize: FontSize.md, color: Colors.gray[700], marginBottom: 24, textAlign: 'center' }}>
              How satisfied are you with the resolution?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <TouchableOpacity key={s} onPress={() => setFeedbackRating(s)}>
                  <Ionicons
                    name={s <= feedbackRating ? 'star' : 'star-outline'}
                    size={48}
                    color={Colors.yellow[500]}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {feedbackRating > 0 && (
              <Text style={{ textAlign: 'center', fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[800], marginBottom: 16 }}>
                {feedbackRating === 5 ? 'Excellent!' : feedbackRating === 4 ? 'Good' : feedbackRating === 3 ? 'Acceptable' : feedbackRating === 2 ? 'Below Expectations' : 'Poor'}
              </Text>
            )}
            <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: 8 }}>
              Comments (optional)
            </Text>
            <TextInput
              style={{
                borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
                padding: Spacing.md, minHeight: 100, textAlignVertical: 'top',
                fontSize: FontSize.md, color: Colors.gray[900],
              }}
              placeholder="Share your experience..."
              placeholderTextColor={Colors.gray[400]}
              multiline
              maxLength={500}
              value={feedbackComment}
              onChangeText={setFeedbackComment}
            />
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: Colors.brand[600], marginTop: 24 }]}
              onPress={submitFeedback}
              disabled={feedbackMutation.isPending || feedbackRating < 1}
            >
              {feedbackMutation.isPending ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="send" size={20} color={Colors.white} />
                  <Text style={styles.actionBtnText}>Submit Feedback</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={16} color={Colors.gray[400]} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, padding: Spacing.xl },
  emptyText: { fontSize: FontSize.md, color: Colors.gray[500], textAlign: 'center' },
  errorDetail: { fontSize: FontSize.sm, color: Colors.gray[400], textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
  },
  retryBtnText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.white },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs, borderRadius: BorderRadius.full,
  },
  statusLabel: { fontSize: FontSize.xs, fontWeight: '600' },
  overdueWarning: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.red[50], borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.red[200],
  },
  overdueText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.red[600] },
  dueBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.gray[100], borderRadius: BorderRadius.md,
    padding: Spacing.sm, marginBottom: Spacing.md,
  },
  dueBoxOverdue: { backgroundColor: Colors.red[50] },
  dueText: { fontSize: FontSize.sm, color: Colors.gray[600] },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray[900], marginBottom: Spacing.xs },
  ref: { fontSize: FontSize.xs, color: Colors.gray[400], fontFamily: 'monospace', marginBottom: Spacing.md },
  actionsCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 3,
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    padding: Spacing.lg, borderRadius: BorderRadius.md,
  },
  actionBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  rejectionCard: {
    backgroundColor: Colors.red[50], borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.red[200],
  },
  rejectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  rejectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.red[700] },
  rejectionReason: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.red[600], marginBottom: Spacing.xs },
  rejectionNotes: { fontSize: FontSize.sm, color: Colors.red[600] },
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900], marginBottom: Spacing.md },
  description: { fontSize: FontSize.md, color: Colors.gray[700], lineHeight: 22 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  detailLabel: { fontSize: FontSize.sm, color: Colors.gray[500], width: 90 },
  detailValue: { fontSize: FontSize.sm, color: Colors.gray[900], fontWeight: '500', flex: 1 },
  photoStageLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[600], marginBottom: Spacing.sm },
  photoScroll: { marginTop: Spacing.xs },
  photo: { width: 120, height: 120, borderRadius: BorderRadius.md, marginRight: Spacing.sm },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  assignAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.brand[100],
    justifyContent: 'center', alignItems: 'center',
  },
  assignAvatarText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.brand[700] },
  assignName: { fontSize: FontSize.md, color: Colors.gray[900], fontWeight: '600' },
  assignMeta: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  ratingText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[700], marginLeft: Spacing.sm },
  feedbackComment: { fontSize: FontSize.sm, color: Colors.gray[600], fontStyle: 'italic' },
  timelineItem: { flexDirection: 'row', marginBottom: Spacing.md },
  timelineLine: { alignItems: 'center', width: 20, marginRight: Spacing.md },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineConnector: { width: 2, flex: 1, backgroundColor: Colors.gray[200], marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: Spacing.sm },
  timelineStatus: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[900] },
  timelineNotes: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
  timelineDate: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: 2 },
  // Modal styles
  modalContainer: { flex: 1, backgroundColor: Colors.white },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.gray[200],
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900] },
  modalContent: { flex: 1, padding: Spacing.lg },
  modalSectionTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[900], marginBottom: Spacing.xs },
  modalHint: { fontSize: FontSize.sm, color: Colors.gray[500], marginBottom: Spacing.md },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  proofPhotoContainer: { position: 'relative' },
  proofPhoto: { width: 100, height: 100, borderRadius: BorderRadius.md },
  removePhotoBtn: { position: 'absolute', top: -8, right: -8, backgroundColor: Colors.white, borderRadius: 12 },
  addPhotoButtons: { flexDirection: 'row', gap: Spacing.md },
  addPhotoBtn: {
    width: 100, height: 100, borderRadius: BorderRadius.md,
    borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.brand[300],
    justifyContent: 'center', alignItems: 'center', gap: Spacing.xs,
  },
  addPhotoLabel: { fontSize: FontSize.xs, color: Colors.brand[600], fontWeight: '500' },
  notesInput: {
    backgroundColor: Colors.gray[50], borderRadius: BorderRadius.md, padding: Spacing.md,
    fontSize: FontSize.md, color: Colors.gray[900], minHeight: 100,
    borderWidth: 1, borderColor: Colors.gray[200],
  },
  modalFooter: { padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.gray[200] },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.green[600], borderRadius: BorderRadius.md, padding: Spacing.lg,
  },
  submitBtnDisabled: { backgroundColor: Colors.gray[300] },
  submitBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
});
