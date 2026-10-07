import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { pickName } from '@shared/types/locale';
import { helpRequestsApi } from '../../lib/api/endpoints';
import { ApiError, getFileUrl } from '../../lib/api/client';
import { getErrorPresentation } from '../../lib/api/errors';
import { useAuthStore } from '../../lib/auth/store';
import { useHasAnyPermission, PERMISSIONS } from '../../lib/hooks/usePermission';
import { getInboxStatusStyle } from '../../lib/inbox/status-config';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { AuthGate } from '../../components/auth-gate';
import {
  GovCard, GovButton, ScreenContainer, LoadingState, EmptyState, SectionHeader, ErrorBanner,
} from '../../components/ui';
import { useTranslate, useLocale, useIsRtl } from '../../lib/i18n';
import { flexRow, textAlignStart } from '../../lib/ui/rtl';

export default function HelpRequestDetailScreen() {
  return (
    <AuthGate>
      <HelpRequestDetailContent />
    </AuthGate>
  );
}

function HelpRequestDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = useIsRtl();
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
      Alert.alert(t('common.success'), t('help.submitSuccess'));
    },
    onError: (err: unknown) => {
      const pres = getErrorPresentation(err, t);
      Alert.alert(t('help.submitFailed'), pres.message);
    },
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError || !data) {
    const pres = isError
      ? getErrorPresentation(error, t)
      : getErrorPresentation(new ApiError(404, 'NOT_FOUND', t('errors.notFound.message')), t);
    return (
      <View style={styles.center}>
        <EmptyState
          title={t(pres.titleKey)}
          message={isError ? pres.message : undefined}
          actionLabel={pres.status !== 403 && pres.status !== 404 ? t('common.retry') : undefined}
          onAction={pres.status !== 403 && pres.status !== 404 ? () => refetch() : undefined}
        />
      </View>
    );
  }

  const hr = data;
  const ctx = hr.complaintContext;
  const st = getInboxStatusStyle(hr.status);
  const fromDept = pickName(hr.fromDepartment, locale) || '—';
  const toDept = pickName(hr.toDepartment, locale) || '—';
  const isAssigned = hr.helperAssigneeId === user?.id;
  const isHelperHod = user?.id && hr.toDepartment?.headUserId === user.id;
  const canSubmit =
    ['ACCEPTED', 'IN_PROGRESS'].includes(hr.status) &&
    (isAssigned || isHelperHod || canRespond);
  const showWebOnly =
    !canSubmit &&
    !['COMPLETED', 'REJECTED', 'DECLINED', 'CANCELLED', 'AUTO_CANCELLED'].includes(hr.status);

  return (
    <ScreenContainer refreshing={isFetching && !isLoading} onRefresh={refetch}>
      <Text style={[styles.heading, textAlignStart(rtl)]}>{t('help.title')}</Text>
      <Text style={[styles.subheading, textAlignStart(rtl)]}>
        {t('help.subtitle', { dept: fromDept })}
      </Text>

      <View style={[styles.badgeRow, flexRow(rtl)]}>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusBadgeText, { color: st.color }]}>{t(st.labelKey)}</Text>
        </View>
        <Text style={[styles.deptLine, textAlignStart(rtl)]}>
          {fromDept} → {toDept}
        </Text>
      </View>

      <GovCard>
        <SectionHeader title={t('help.section.reason')} />
        <Text style={[styles.body, textAlignStart(rtl)]}>{hr.reason}</Text>
      </GovCard>

      {hr.helperAssignee ? (
        <GovCard style={styles.gap}>
          <SectionHeader title={t('help.assignedHelper')} />
          <Text style={[styles.body, textAlignStart(rtl)]}>
            {hr.helperAssignee.firstName} {hr.helperAssignee.lastName}
          </Text>
        </GovCard>
      ) : null}

      {ctx ? (
        <GovCard style={styles.gap}>
          <SectionHeader title={t('help.section.context')} />
          {ctx.referenceCode ? (
            <Text style={[styles.ref, textAlignStart(rtl)]}>{ctx.referenceCode}</Text>
          ) : null}
          <Text style={[styles.ctxTitle, textAlignStart(rtl)]}>{ctx.title}</Text>
          {ctx.category?.name ? (
            <Text style={[styles.meta, textAlignStart(rtl)]}>{ctx.category.name}</Text>
          ) : null}
          <Text style={[styles.body, textAlignStart(rtl)]}>{ctx.description}</Text>
          {ctx.address ? (
            <View style={[styles.locationRow, flexRow(rtl)]}>
              <Ionicons name="location-outline" size={16} color={Colors.gray[500]} />
              <Text style={[styles.meta, textAlignStart(rtl), { flex: 1 }]}>{ctx.address}</Text>
            </View>
          ) : null}
          {ctx.attachments?.length ? (
            <View style={[styles.thumbs, flexRow(rtl)]}>
              {ctx.attachments.map((a: { id: string; url: string }) => (
                <Image
                  key={a.id}
                  source={{ uri: getFileUrl(a.url) }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ))}
            </View>
          ) : null}
        </GovCard>
      ) : null}

      {hr.solutionNotes ? (
        <GovCard style={styles.gap}>
          <SectionHeader title={t('help.section.result')} />
          <Text style={[styles.body, textAlignStart(rtl)]}>{hr.solutionNotes}</Text>
        </GovCard>
      ) : null}

      {hr.timeline?.length > 0 ? (
        <GovCard style={styles.gap}>
          <SectionHeader title={t('help.section.timeline')} />
          {hr.timeline.map((ev: { id: string; eventKind: string | null; notes: string | null }) => (
            <View key={ev.id} style={[styles.timelineItem, rtl ? styles.timelineRtl : null]}>
              <Text style={[styles.timelineKind, textAlignStart(rtl)]}>{ev.eventKind}</Text>
              {ev.notes ? (
                <Text style={[styles.meta, textAlignStart(rtl)]}>{ev.notes}</Text>
              ) : null}
            </View>
          ))}
        </GovCard>
      ) : null}

      {showWebOnly ? (
        <ErrorBanner title={t('help.webOnly')} variant="info" />
      ) : null}

      {canSubmit ? (
        <GovCard style={styles.gap}>
          <SectionHeader title={t('help.section.actions')} />
          <Text style={[styles.hint, textAlignStart(rtl)]}>{t('help.notesOnly')}</Text>
          {!showSubmit ? (
            <GovButton
              label={t('help.submitResult')}
              onPress={() => setShowSubmit(true)}
              icon="create-outline"
            />
          ) : (
            <>
              <TextInput
                style={[styles.input, textAlignStart(rtl)]}
                multiline
                placeholder={t('help.notesPlaceholder')}
                placeholderTextColor={Colors.gray[400]}
                value={notes}
                onChangeText={setNotes}
              />
              <GovButton
                label={t('common.submit')}
                onPress={() => submitMutation.mutate()}
                disabled={notes.trim().length < 5 || submitMutation.isPending}
                loading={submitMutation.isPending}
              />
              <GovButton
                label={t('common.cancel')}
                onPress={() => setShowSubmit(false)}
                variant="outline"
                style={{ marginTop: Spacing.sm }}
              />
            </>
          )}
        </GovCard>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: Colors.surface },
  heading: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray[900] },
  subheading: { marginTop: 4, fontSize: FontSize.sm, color: Colors.gray[600], lineHeight: 20 },
  badgeRow: { marginTop: Spacing.md, marginBottom: Spacing.md, alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  statusBadgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  deptLine: { fontSize: FontSize.sm, color: Colors.gray[600], flex: 1 },
  gap: { marginTop: Spacing.md },
  ref: { fontFamily: 'monospace', fontSize: FontSize.xs, color: Colors.gray[500] },
  ctxTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.gray[900], marginTop: 4 },
  body: { fontSize: FontSize.sm, color: Colors.gray[700], lineHeight: 20 },
  meta: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 4 },
  locationRow: { alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  thumbs: { flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  thumb: { width: 80, height: 80, borderRadius: BorderRadius.md },
  timelineItem: {
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.brand[200],
  },
  timelineRtl: {
    paddingLeft: 0,
    paddingRight: Spacing.md,
    borderLeftWidth: 0,
    borderRightWidth: 2,
    borderRightColor: Colors.brand[200],
  },
  timelineKind: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[800] },
  hint: { fontSize: FontSize.xs, color: Colors.gray[500], marginBottom: Spacing.md, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 100,
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    textAlignVertical: 'top',
    fontSize: FontSize.md,
    color: Colors.gray[900],
  },
});
