import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, Alert, ScrollView, Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { pickName } from '@shared/types/locale';
import { useAuthStore } from '../../lib/auth/store';
import { authApi, notificationsApi } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { getErrorPresentation } from '../../lib/api/errors';
import {
  useAccountKind,
  useHasCitizenRole,
  useIsFieldWorker,
  useCitizenMobileExperience,
} from '../../lib/hooks/usePermission';
import {
  GovCard, GovButton, ErrorBanner, LoadingState, EmptyState, TabScreenShell,
  InfoRow, MenuRow, UserAvatar,
} from '../../components/ui';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { useLocale, useTranslate, useIsRtl } from '../../lib/i18n';
import { flexRow, chevronForward, textAlignStart } from '../../lib/ui/rtl';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';

export default function ProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, logout, updateUser, refreshToken } = useAuthStore();
  const t = useTranslate();
  const rtl = useIsRtl();
  const locale = useLocale();
  const accountKind = useAccountKind();
  const isFieldWorker = useIsFieldWorker();
  const citizenMobile = useCitizenMobileExperience();
  const hasCitizenRole = useHasCitizenRole();
  const { contentPaddingBottom, horizontalPadding } = useTabScreenInsets();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarCacheBust, setAvatarCacheBust] = useState<string | number>(0);
  const [resendingVerification, setResendingVerification] = useState(false);

  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });

  const { data: unread } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
  });

  useEffect(() => {
    if (profile) {
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone || '',
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: () =>
      authApi.updateProfile({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      }),
    onSuccess: (data: { firstName?: string; lastName?: string }) => {
      updateUser({
        firstName: data?.firstName || form.firstName,
        lastName: data?.lastName || form.lastName,
        phone: form.phone || undefined,
      });
      Alert.alert(t('common.success'), t('profile.updated'));
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError && err.details?.length) {
        Alert.alert(t('common.error'), err.details.map((d) => `• ${d.message}`).join('\n'));
      } else {
        Alert.alert(t('common.error'), getErrorPresentation(err, t).message);
      }
    },
  });

  const handlePickAvatar = () => {
    Alert.alert(t('profile.changePhoto'), undefined, [
      {
        text: t('submit.gallery'),
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(t('common.error'), t('submit.permission.camera'));
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadAvatarAsset(result.assets[0]);
          }
        },
      },
      {
        text: t('submit.camera'),
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(t('common.error'), t('submit.permission.camera'));
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });
          if (!result.canceled && result.assets[0]) {
            await uploadAvatarAsset(result.assets[0]);
          }
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const uploadAvatarAsset = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploadingAvatar(true);
    try {
      const { prepareImageForUpload } = await import('../../lib/utils/prepare-upload-image');
      const prepared = await prepareImageForUpload({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        kind: 'avatar',
        square: true,
      });
      const { avatarUrl } = await authApi.uploadAvatar({
        uri: prepared.uri,
        name: prepared.name,
        type: prepared.type,
      });
      const bust = Date.now();
      setAvatarCacheBust(bust);
      updateUser({ avatarUrl });
      queryClient.setQueryData(['profile'], (old: typeof profile) =>
        old ? { ...old, avatarUrl } : old,
      );
      await queryClient.refetchQueries({ queryKey: ['profile'] });
      Alert.alert(t('common.success'), t('profile.photoUpdated'));
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof ApiError ? err.message : t('profile.photoFailed'),
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleResendVerification = async () => {
    const email = profile?.email || user?.email;
    if (!email) return;
    setResendingVerification(true);
    try {
      await authApi.resendVerification(email);
      Alert.alert(t('common.success'), t('auth.unverified.resendSuccess'));
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof ApiError ? err.message : t('common.error'),
      );
    } finally {
      setResendingVerification(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.signOut'),
        style: 'destructive',
        onPress: async () => {
          const rt = refreshToken;
          await logout();
          if (rt) {
            try {
              await authApi.logout(rt);
            } catch {
              /* ignore */
            }
          }
        },
      },
    ]);
  };

  const accountTypeLabel =
    accountKind === 'citizen'
      ? t('profile.accountType.citizen')
      : accountKind === 'field_worker'
        ? t('profile.accountType.worker')
        : accountKind === 'supervisor'
          ? t('profile.accountType.supervisor')
          : accountKind === 'admin'
            ? t('profile.accountType.admin')
            : t('profile.accountType.staff');

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <TabScreenShell centerContent>
        <EmptyState
          compact
          title={t('profile.loadError')}
          message={getErrorPresentation(error, t).message}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      </TabScreenShell>
    );
  }

  const displayUser = profile ?? user;
  /** Auth store updates synchronously on upload; prefer it over stale query cache. */
  const displayAvatarUrl = user?.avatarUrl ?? profile?.avatarUrl;
  const emailVerified = displayUser?.emailVerified !== false;
  const kycStatus = displayUser?.verificationStatus;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: horizontalPadding, paddingBottom: contentPaddingBottom },
      ]}
    >
      <GovCard>
        <View style={[styles.avatarSection, rtl && styles.avatarSectionRtl]}>
          <Pressable
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            style={styles.avatarWrap}
            accessibilityLabel={t('profile.changePhoto')}
          >
            <UserAvatar
              url={displayAvatarUrl}
              firstName={displayUser?.firstName}
              lastName={displayUser?.lastName}
              size={80}
              cacheBust={avatarCacheBust || displayAvatarUrl}
              loading={uploadingAvatar}
            />
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={16} color={Colors.white} />
            </View>
          </Pressable>
          <Text style={[styles.name, textAlignStart(rtl)]}>
            {displayUser?.firstName} {displayUser?.lastName}
          </Text>
          <Text style={[styles.email, textAlignStart(rtl)]}>{displayUser?.email}</Text>
          <View style={[styles.badgeRow, flexRow(rtl), rtl && styles.badgeRowRtl]}>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{accountTypeLabel}</Text>
            </View>
            {kycStatus === 'VERIFIED' && (
              <View style={[styles.verifiedPill, flexRow(rtl)]}>
                <Ionicons name="shield-checkmark" size={14} color={Colors.cedar[700]} />
                <Text style={styles.verifiedText}>{t('profile.verified')}</Text>
              </View>
            )}
          </View>
        </View>
      </GovCard>

      {!emailVerified && (
        <GovCard accent="warning">
          <ErrorBanner title={t('auth.unverified.title')} message={t('profile.verifyEmailHint')} variant="warning" />
          <GovButton
            label={resendingVerification ? t('auth.2fa.resending') : t('auth.unverified.resend')}
            onPress={handleResendVerification}
            loading={resendingVerification}
            variant="outline"
            style={{ marginTop: Spacing.sm }}
          />
        </GovCard>
      )}

      {hasCitizenRole && kycStatus !== 'VERIFIED' && (
        <GovCard accent="warning" onPress={() => router.push('/kyc')}>
          <View style={[flexRow(rtl), { gap: Spacing.md }]}>
            <Ionicons
              name={kycStatus === 'PENDING' ? 'time-outline' : 'shield-outline'}
              size={28}
              color={kycStatus === 'PENDING' ? Colors.orange[600] : Colors.red[600]}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, textAlignStart(rtl)]}>
                {kycStatus === 'PENDING' ? t('profile.verifyPending') : t('profile.verifyMissing')}
              </Text>
              <Text style={[styles.bannerBody, textAlignStart(rtl)]}>
                {kycStatus === 'PENDING'
                  ? t('profile.verifyPendingHint')
                  : t('profile.verifyMissingHint')}
              </Text>
            </View>
            <Ionicons name={chevronForward(rtl)} size={20} color={Colors.gray[400]} />
          </View>
        </GovCard>
      )}

      <GovCard>
        <View style={[styles.cardHeader, flexRow(rtl)]}>
          <Text style={[styles.cardTitle, textAlignStart(rtl)]}>{t('profile.personalInfo')}</Text>
          {!editing && (
            <Pressable onPress={() => setEditing(true)}>
              <Text style={styles.editLink}>{t('profile.edit')}</Text>
            </Pressable>
          )}
        </View>
        {editing ? (
          <>
            <Text style={[styles.label, textAlignStart(rtl)]}>{t('profile.firstName')}</Text>
            <TextInput
              style={[styles.input, textAlignStart(rtl)]}
              value={form.firstName}
              onChangeText={(v) => setForm({ ...form, firstName: v })}
            />
            <Text style={[styles.label, { marginTop: Spacing.md }, textAlignStart(rtl)]}>{t('profile.lastName')}</Text>
            <TextInput
              style={[styles.input, textAlignStart(rtl)]}
              value={form.lastName}
              onChangeText={(v) => setForm({ ...form, lastName: v })}
            />
            <Text style={[styles.label, { marginTop: Spacing.md }, textAlignStart(rtl)]}>{t('profile.phone')}</Text>
            <TextInput
              style={[styles.input, textAlignStart(rtl)]}
              value={form.phone}
              onChangeText={(v) => setForm({ ...form, phone: v })}
              keyboardType="phone-pad"
            />
            <View style={[styles.editActions, flexRow(rtl)]}>
              <GovButton label={t('common.cancel')} onPress={() => setEditing(false)} variant="outline" style={{ flex: 1 }} />
              <GovButton
                label={t('common.save')}
                onPress={() => updateMutation.mutate()}
                loading={updateMutation.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </>
        ) : (
          <>
            <InfoRow rtl={rtl} icon="person-outline" label={t('profile.name')} value={`${displayUser?.firstName} ${displayUser?.lastName}`} />
            <InfoRow rtl={rtl} icon="mail-outline" label={t('profile.email')} value={displayUser?.email ?? ''} />
            <InfoRow
              rtl={rtl}
              icon="call-outline"
              label={t('profile.phone')}
              value={displayUser?.phone || t('profile.notSet')}
            />
            <InfoRow
              rtl={rtl}
              icon="business-outline"
              label={t('profile.municipality')}
              value={pickName(displayUser?.municipality as Parameters<typeof pickName>[0], locale) || '—'}
            />
            {hasCitizenRole && (
              <InfoRow
                rtl={rtl}
                icon="mail-unread-outline"
                label={t('profile.emailStatus')}
                value={emailVerified ? t('profile.emailVerified') : t('profile.emailUnverified')}
              />
            )}
            {hasCitizenRole && (
              <InfoRow
                rtl={rtl}
                icon="shield-outline"
                label={t('profile.kycStatus')}
                value={
                  kycStatus === 'VERIFIED'
                    ? t('profile.verified')
                    : kycStatus === 'PENDING'
                      ? t('profile.verifyPending')
                      : t('profile.verifyMissing')
                }
              />
            )}
            {isFieldWorker && displayUser?.department && (
              <InfoRow
                rtl={rtl}
                icon="git-branch-outline"
                label={t('profile.department')}
                value={pickName(displayUser.department as Parameters<typeof pickName>[0], locale)}
              />
            )}
          </>
        )}
      </GovCard>

      <GovCard>
        <Text style={[styles.cardTitle, textAlignStart(rtl)]}>{t('profile.shortcuts')}</Text>
        <MenuRow
          rtl={rtl}
          icon="shield-checkmark-outline"
          label={t('profile.security')}
          trailing={
            (profile as { twoFactorEnabled?: boolean })?.twoFactorEnabled
              ? t('profile.2fa.enabled')
              : undefined
          }
          onPress={() => router.push('/security')}
        />
        <MenuRow
          rtl={rtl}
          icon="notifications-outline"
          label={t('profile.notifications')}
          badge={unread?.unreadCount}
          onPress={() => router.push('/notifications')}
        />
        <MenuRow rtl={rtl} icon="language-outline" label={t('common.language')} trailing={locale === 'ar' ? 'العربية' : locale === 'fr' ? 'Français' : 'English'} onPress={() => router.push('/language')} />
        {citizenMobile && (
          <>
            <MenuRow rtl={rtl} icon="list-outline" label={t('profile.myReports')} onPress={() => router.push('/(tabs)/complaints')} />
            <MenuRow rtl={rtl} icon="add-circle-outline" label={t('profile.submitComplaint')} onPress={() => router.push('/(tabs)/submit')} />
            {hasCitizenRole && kycStatus !== 'VERIFIED' && (
              <MenuRow rtl={rtl} icon="shield-checkmark-outline" label={t('profile.kycStatus')} onPress={() => router.push('/kyc')} />
            )}
          </>
        )}
        {isFieldWorker && (
          <MenuRow rtl={rtl} icon="clipboard-outline" label={t('profile.myAssignments')} onPress={() => router.push('/(tabs)/tasks')} />
        )}
      </GovCard>

      <GovButton label={t('profile.signOut')} onPress={handleLogout} variant="danger" icon="log-out-outline" />
      <Text style={styles.version}>Baladiyati v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { paddingTop: Spacing.md, gap: Spacing.md },
  center: { flex: 1, justifyContent: 'center', backgroundColor: Colors.surface },
  avatarSection: { alignItems: 'center' },
  avatarSectionRtl: { alignItems: 'stretch' },
  avatarWrap: { position: 'relative', marginBottom: Spacing.md },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.brand[600],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  name: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray[900] },
  email: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 2 },
  badgeRow: { marginTop: Spacing.sm, gap: Spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  badgeRowRtl: { justifyContent: 'flex-end' },
  roleBadge: {
    backgroundColor: Colors.brand[50],
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  roleText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.brand[700] },
  verifiedPill: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.cedar[50],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  verifiedText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.cedar[700] },
  bannerTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.gray[900] },
  bannerBody: { fontSize: FontSize.xs, color: Colors.gray[600], marginTop: 2 },
  cardHeader: { justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900] },
  editLink: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[600] },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.gray[900],
    backgroundColor: Colors.white,
  },
  editActions: { gap: Spacing.md, marginTop: Spacing.lg },
  securityLine: { fontSize: FontSize.sm, color: Colors.gray[700], marginTop: Spacing.xs },
  hint: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: Spacing.xs },
  version: { fontSize: FontSize.xs, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.md },
});
