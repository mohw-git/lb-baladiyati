import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Alert, Modal, TextInput, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { complaintsApi } from '../../lib/api/endpoints';
import { getFileUrl, ApiError } from '../../lib/api/client';
import { getErrorPresentation } from '../../lib/api/errors';
import { useCanChangeStatus, useIsFieldWorker } from '../../lib/hooks/usePermission';
import { useAuthStore } from '../../lib/auth/store';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { HelpRequestSection } from '../../components/help-requests/HelpRequestSection';
import { AuthGate } from '../../components/auth-gate';
import { getComplaintStatusBadge } from '../../lib/complaints/status-config';
import { invalidateComplaintQueries } from '../../lib/query/invalidate-complaints';
import { useTranslate, useIsRtl } from '../../lib/i18n';
import {
  GovCard, GovButton, StatusChip, ErrorBanner, LoadingState, EmptyState,
} from '../../components/ui';
import { PriorityChip } from '../../components/complaints/PriorityChip';
import { flexRow, textAlignStart } from '../../lib/ui/rtl';
import { useStableRefresh } from '../../lib/ui/use-stable-refresh';

export default function ComplaintDetailScreen() {
  return (
    <AuthGate>
      <ComplaintDetailContent />
    </AuthGate>
  );
}

function ComplaintDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const t = useTranslate();
  const rtl = useIsRtl();
  const isFieldWorker = useIsFieldWorker();
  const canChangeStatus = useCanChangeStatus();
  
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [workNotes, setWorkNotes] = useState('');
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState('');

  const { data: complaint, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['complaint', id],
    queryFn: () => complaintsApi.getById(id),
    enabled: !!id,
  });

  const handleRefresh = useCallback(() => refetch(), [refetch]);
  const stableRefresh = useStableRefresh({ onRefresh: handleRefresh });

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
    onSuccess: (_data, variables) => {
      invalidateComplaintQueries(queryClient, id);
      setShowProofModal(false);
      setProofPhotos([]);
      setWorkNotes('');
      const msg =
        variables.status === 'PENDING_APPROVAL'
          ? t('worker.workSubmitted')
          : t('worker.statusUpdated');
      Alert.alert(t('common.success'), msg);
    },
    onError: (err: unknown) => {
      const pres = getErrorPresentation(err, t);
      if (err instanceof ApiError && err.status === 409) {
        setShowProofModal(false);
        invalidateComplaintQueries(queryClient, id);
      }
      Alert.alert(t(pres.titleKey), pres.message);
    },
  });

  const handleStartWork = () => {
    Alert.alert(t('detail.startWorkTitle'), t('detail.startWorkBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('detail.startWorkConfirm'), onPress: () => statusMutation.mutate({ status: 'IN_PROGRESS' }) },
    ]);
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
      Alert.alert(t('common.error'), t('submit.permission.camera'));
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
      Alert.alert(t('detail.proofRequired'), t('detail.proofRequiredBody'));
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
      Alert.alert(t('detail.feedbackThanks'), t('detail.feedbackSubmitted'));
    },
    onError: (err: unknown) => {
      Alert.alert(t('common.error'), getErrorPresentation(err, t).message);
    },
  });

  const submitFeedback = () => {
    if (feedbackRating < 1 || feedbackRating > 5) {
      Alert.alert(t('detail.ratingRequired'), t('detail.ratingRequiredBody'));
      return;
    }
    feedbackMutation.mutate();
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !complaint) {
    const pres = isError
      ? getErrorPresentation(error, t)
      : getErrorPresentation(new ApiError(404, 'NOT_FOUND', t('errors.notFound.message')), t);
    const isPreview403 = pres.status === 403;
    return (
      <View style={styles.center}>
        <EmptyState
          icon={
            isPreview403
              ? 'eye-outline'
              : pres.status === 404
                ? 'document-outline'
                : pres.isNetwork
                  ? 'cloud-offline-outline'
                  : 'alert-circle-outline'
          }
          title={isPreview403 ? t('detail.previewAccess') : t(pres.titleKey as 'errors.notFound.title')}
          message={isPreview403 ? t('detail.previewAccessBody') : pres.message}
          actionLabel={pres.status !== 404 && pres.status !== 403 ? t('common.retry') : undefined}
          onAction={
            pres.status !== 404 && pres.status !== 403 ? () => refetch() : undefined
          }
        />
      </View>
    );
  }

  const isOwner = complaint.createdBy?.id === user?.id;
  const showCitizenOwnerBanner = !isFieldWorker && isOwner;
  const isAssignedToMe = complaint.currentAssignment?.assignedTo?.id === user?.id;
  const showWorkerActions = canChangeStatus && isAssignedToMe;
  const showAwaitingReview =
    complaint.status === 'PENDING_APPROVAL' && isAssignedToMe;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={stableRefresh.refreshControl}
        onScroll={stableRefresh.onScroll}
        scrollEventThrottle={stableRefresh.scrollEventThrottle}
      >
        <GovCard accent="brand">
          <View style={[styles.headerRow, flexRow(rtl)]}>
            {complaint.referenceCode ? (
              <Text style={[styles.ref, textAlignStart(rtl)]}>{complaint.referenceCode}</Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <View style={[styles.chipRow, flexRow(rtl)]}>
              <StatusChip status={complaint.status} />
              {complaint.priority ? <PriorityChip priority={complaint.priority} /> : null}
            </View>
          </View>
          <Text style={[styles.title, textAlignStart(rtl)]}>{complaint.title}</Text>
          {complaint.dueDate ? (
            <View style={[styles.dueInline, flexRow(rtl)]}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={complaint.isOverdue ? Colors.red[600] : Colors.gray[500]}
              />
              <Text style={[styles.dueText, complaint.isOverdue && styles.dueOverdue, textAlignStart(rtl)]}>
                {t('detail.due', { date: new Date(complaint.dueDate).toLocaleString() })}
              </Text>
            </View>
          ) : null}
        </GovCard>

        {complaint.isOverdue && (
          <ErrorBanner title={t('detail.overdue')} variant="error" />
        )}

        {showCitizenOwnerBanner && (
          <GovCard accent="cedar">
            <Text style={[styles.bannerTitle, textAlignStart(rtl)]}>{t('detail.citizenStatus')}</Text>
            <Text style={[styles.bannerBody, textAlignStart(rtl)]}>{t('detail.citizenStatusBody')}</Text>
          </GovCard>
        )}

        {showWorkerActions && !showAwaitingReview && (
          <GovCard accent="brand">
            <Text style={[styles.bannerTitle, textAlignStart(rtl)]}>{t('detail.assignedToYou')}</Text>
            <Text style={[styles.bannerBody, textAlignStart(rtl)]}>{t('detail.assignedToYouBody')}</Text>
          </GovCard>
        )}

        {showAwaitingReview && (
          <GovCard accent="warning">
            <View style={[flexRow(rtl), { gap: Spacing.sm }]}>
              <Ionicons name="hourglass-outline" size={22} color={Colors.purple[700]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.awaitingTitle, textAlignStart(rtl)]}>{t('worker.awaitingReview.title')}</Text>
                <Text style={[styles.awaitingBody, textAlignStart(rtl)]}>{t('worker.awaitingReview.body')}</Text>
              </View>
            </View>
          </GovCard>
        )}

        {showWorkerActions && (
          <GovCard>
            <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('detail.section.workerActions')}</Text>
            {complaint.status === 'ASSIGNED' && (
              <GovButton
                label={t('worker.startWork')}
                onPress={handleStartWork}
                disabled={statusMutation.isPending}
                loading={statusMutation.isPending}
                icon="play-outline"
              />
            )}
            {complaint.status === 'IN_PROGRESS' && (
              <GovButton
                label={t('worker.submitForApproval')}
                onPress={handleSubmitForApproval}
                disabled={statusMutation.isPending}
                variant="secondary"
                icon="checkmark-circle-outline"
              />
            )}
          </GovCard>
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
          <GovCard accent="warning">
            <View style={[flexRow(rtl), { gap: Spacing.sm, marginBottom: Spacing.sm }]}>
              <Ionicons name="close-circle" size={20} color={Colors.red[600]} />
              <Text style={[styles.rejectionTitle, textAlignStart(rtl)]}>{t('detail.rejected')}</Text>
            </View>
            <Text style={[styles.rejectionReason, textAlignStart(rtl)]}>
              {complaint.rejectionReason.replace(/_/g, ' ')}
            </Text>
            {complaint.rejectionNotes ? (
              <Text style={[styles.rejectionNotes, textAlignStart(rtl)]}>{complaint.rejectionNotes}</Text>
            ) : null}
          </GovCard>
        )}

        {/* Feedback section - shown to citizen owner when complaint is COMPLETED/CLOSED */}
        {(complaint.status === 'COMPLETED' || complaint.status === 'CLOSED') &&
          complaint.createdBy?.id === user?.id && (
            complaint.feedback ? (
              <GovCard accent="cedar">
                <View style={[flexRow(rtl), { gap: 8, marginBottom: 6 }]}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.green[600]} />
                  <Text style={[styles.sectionTitle, { color: Colors.cedar[700], marginBottom: 0 }, textAlignStart(rtl)]}>
                    {t('detail.section.feedback')}
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
              </GovCard>
            ) : (
              <GovCard>
                <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('detail.section.feedbackPrompt')}</Text>
                <Text style={[styles.bannerBody, textAlignStart(rtl)]}>{t('detail.section.feedbackPromptBody')}</Text>
                <GovButton
                  label={t('detail.rateResolution')}
                  onPress={() => setShowFeedbackModal(true)}
                  icon="star-outline"
                  style={{ marginTop: Spacing.md }}
                />
              </GovCard>
            )
          )}

        <GovCard>
          <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('detail.section.description')}</Text>
          <Text style={[styles.description, textAlignStart(rtl)]}>{complaint.description}</Text>
        </GovCard>

        <GovCard>
          <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('detail.section.details')}</Text>
          <DetailRow rtl={rtl} icon="pricetag-outline" label={t('detail.field.category')} value={complaint.category?.name || '—'} />
          {complaint.department ? (
            <DetailRow rtl={rtl} icon="business-outline" label={t('detail.field.department')} value={complaint.department.name} />
          ) : null}
          {complaint.address ? (
            <DetailRow rtl={rtl} icon="location-outline" label={t('detail.field.address')} value={complaint.address} />
          ) : null}
          {complaint.latitude && complaint.longitude ? (
            <DetailRow
              rtl={rtl}
              icon="navigate-outline"
              label={t('detail.field.coordinates')}
              value={`${parseFloat(complaint.latitude).toFixed(6)}, ${parseFloat(complaint.longitude).toFixed(6)}`}
            />
          ) : null}
          <DetailRow rtl={rtl} icon="calendar-outline" label={t('detail.field.submitted')} value={new Date(complaint.createdAt).toLocaleString()} />
          {complaint.resolvedAt ? (
            <DetailRow rtl={rtl} icon="checkmark-done-outline" label={t('detail.field.resolved')} value={new Date(complaint.resolvedAt).toLocaleString()} />
          ) : null}
        </GovCard>

        {complaint.attachments?.length > 0 && (
          <GovCard>
            <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('detail.section.photos')}</Text>
            {complaint.attachments.filter((a: any) => a.stage === 'SUBMISSION').length > 0 && (
              <>
                <Text style={[styles.photoStageLabel, textAlignStart(rtl)]}>{t('detail.photos.submission')}</Text>
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
                <Text style={[styles.photoStageLabel, { marginTop: Spacing.md }, textAlignStart(rtl)]}>
                  {t('detail.photos.proof')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                  {complaint.attachments.filter((a: any) => a.stage === 'PROOF').map((a: any) => (
                    <Image key={a.id} source={{ uri: getFileUrl(a.url) }} style={styles.photo} resizeMode="cover" />
                  ))}
                </ScrollView>
              </>
            )}
          </GovCard>
        )}

        {complaint.currentAssignment && (
          <GovCard>
            <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('detail.section.assignment')}</Text>
            <View style={[styles.assignRow, flexRow(rtl)]}>
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
                <Text style={[styles.assignMeta, textAlignStart(rtl)]}>
                  {t('detail.assignedBy', {
                    name: `${complaint.currentAssignment.assignedBy?.firstName ?? ''} ${complaint.currentAssignment.assignedBy?.lastName ?? ''}`.trim(),
                  })}
                </Text>
              </View>
            </View>
          </GovCard>
        )}

        {complaint.feedback && !isOwner && (
          <GovCard>
            <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('detail.section.feedback')}</Text>
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
          </GovCard>
        )}

        {complaint.statusHistory?.length > 0 && (
          <GovCard accent="brand">
            <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('detail.section.timeline')}</Text>
            <Text style={[styles.timelineHint, textAlignStart(rtl)]}>{t('detail.timelineHint')}</Text>
            {complaint.statusHistory.map((log: any, i: number) => {
              const logCfg = getComplaintStatusBadge(log.toStatus, t);
              return (
                <View key={log.id} style={[styles.timelineItem, flexRow(rtl)]}>
                  <View style={styles.timelineLine}>
                    <View style={[styles.timelineDot, { backgroundColor: logCfg.color }]} />
                    {i < complaint.statusHistory.length - 1 && <View style={styles.timelineConnector} />}
                  </View>
                  <View style={[styles.timelineContent, rtl ? { marginRight: Spacing.md } : { marginLeft: Spacing.md }]}>
                    <Text style={[styles.timelineStatus, textAlignStart(rtl)]}>{logCfg.label}</Text>
                    {log.notes ? <Text style={[styles.timelineNotes, textAlignStart(rtl)]}>{log.notes}</Text> : null}
                    <Text style={[styles.timelineDate, textAlignStart(rtl)]}>
                      {log.changedBy ? `${log.changedBy.firstName} ${log.changedBy.lastName} · ` : ''}
                      {new Date(log.createdAt).toLocaleString()}
                    </Text>
                  </View>
                </View>
              );
            })}
          </GovCard>
        )}
      </ScrollView>

      {/* Proof upload modal */}
      <Modal visible={showProofModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowProofModal(false)}>
              <Ionicons name="close" size={24} color={Colors.gray[900]} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('detail.proofModalTitle')}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.modalSectionTitle}>{t('detail.proofRequired')}</Text>
            <Text style={styles.modalHint}>{t('detail.proofHint')}</Text>

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
                    <Text style={styles.addPhotoLabel}>{t('submit.camera')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.addPhotoBtn} onPress={pickProofPhoto}>
                    <Ionicons name="images" size={28} color={Colors.brand[600]} />
                    <Text style={styles.addPhotoLabel}>{t('submit.gallery')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <Text style={[styles.modalSectionTitle, { marginTop: Spacing.xl }]}>{t('detail.workNotes')}</Text>
            <TextInput
              style={styles.notesInput}
              placeholder={t('detail.workNotesPlaceholder')}
              value={workNotes}
              onChangeText={setWorkNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <GovButton
              label={t('worker.submitForApproval')}
              onPress={submitProof}
              disabled={!proofPhotos.length}
              loading={statusMutation.isPending}
              icon="cloud-upload-outline"
            />
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal visible={showFeedbackModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('detail.feedbackModalTitle')}</Text>
            <TouchableOpacity onPress={() => setShowFeedbackModal(false)}>
              <Ionicons name="close" size={28} color={Colors.gray[600]} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: Spacing.lg }}>
            <Text style={{ fontSize: FontSize.md, color: Colors.gray[700], marginBottom: 24, textAlign: 'center' }}>
              {t('detail.feedbackPromptModal')}
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
              {t('detail.feedbackComments')}
            </Text>
            <TextInput
              style={{
                borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
                padding: Spacing.md, minHeight: 100, textAlignVertical: 'top',
                fontSize: FontSize.md, color: Colors.gray[900],
              }}
              placeholder={t('detail.feedbackPlaceholder')}
              placeholderTextColor={Colors.gray[400]}
              multiline
              maxLength={500}
              value={feedbackComment}
              onChangeText={setFeedbackComment}
            />
            <GovButton
              label={t('detail.submitFeedback')}
              onPress={submitFeedback}
              disabled={feedbackRating < 1}
              loading={feedbackMutation.isPending}
              icon="send-outline"
              style={{ marginTop: 24 }}
            />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function DetailRow({
  icon,
  label,
  value,
  rtl,
}: {
  icon: string;
  label: string;
  value: string;
  rtl: boolean;
}) {
  return (
    <View style={[styles.detailRow, flexRow(rtl)]}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={Colors.gray[400]} />
      <Text style={[styles.detailLabel, textAlignStart(rtl)]}>{label}</Text>
      <Text style={[styles.detailValue, textAlignStart(rtl)]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.lg, paddingBottom: 40, gap: Spacing.md },
  center: { flex: 1, justifyContent: 'center', backgroundColor: Colors.surface },
  headerRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  chipRow: { gap: Spacing.xs, flexShrink: 0 },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.navy[900], marginTop: Spacing.sm, lineHeight: 28 },
  ref: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.navy[700],
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textTransform: 'uppercase',
  },
  dueInline: { alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  dueText: { fontSize: FontSize.sm, color: Colors.gray[600] },
  dueOverdue: { color: Colors.red[600], fontWeight: '600' },
  bannerTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gray[900] },
  bannerBody: { fontSize: FontSize.xs, color: Colors.gray[600], marginTop: 4, lineHeight: 18 },
  rejectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.red[700], flex: 1 },
  rejectionReason: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.red[600] },
  rejectionNotes: { fontSize: FontSize.sm, color: Colors.red[600], marginTop: Spacing.xs },
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
  timelineHint: {
    fontSize: FontSize.xs,
    color: Colors.gray[500],
    marginBottom: Spacing.lg,
    marginTop: -Spacing.sm,
  },
  timelineItem: { marginBottom: Spacing.lg },
  timelineLine: { alignItems: 'center', width: 24 },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  timelineConnector: { width: 2, flex: 1, backgroundColor: Colors.navy[200], marginTop: 4 },
  timelineContent: {
    flex: 1,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[200],
  },
  timelineStatus: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.navy[900] },
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
  awaitingTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.purple[700] },
  awaitingBody: { fontSize: FontSize.xs, color: Colors.purple[700], marginTop: 4, lineHeight: 18 },
});
