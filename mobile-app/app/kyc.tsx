import { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Alert, Image, TouchableOpacity, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kycApi, authApi } from '../lib/api/endpoints';
import { ApiError } from '../lib/api/client';
import { getErrorPresentation } from '../lib/api/errors';
import { useAuthStore } from '../lib/auth/store';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { AuthGate } from '../components/auth-gate';
import {
  GovCard, GovButton, ScreenContainer, ScreenSurface, LoadingState, ErrorBanner, SectionHeader,
} from '../components/ui';
import { useTranslate, useIsRtl } from '../lib/i18n';
import { flexRow, textAlignStart } from '../lib/ui/rtl';
import type { MessageKey } from '../lib/i18n/messages';

type DocKey = 'idFront' | 'idBack' | 'selfie';

const DOC_KEYS: DocKey[] = ['idFront', 'idBack', 'selfie'];

const DOC_META: Record<DocKey, { labelKey: MessageKey; descKey: MessageKey; icon: keyof typeof Ionicons.glyphMap }> = {
  idFront: { labelKey: 'kyc.doc.idFront', descKey: 'kyc.doc.idFrontDesc', icon: 'card' },
  idBack: { labelKey: 'kyc.doc.idBack', descKey: 'kyc.doc.idBackDesc', icon: 'card-outline' },
  selfie: { labelKey: 'kyc.doc.selfie', descKey: 'kyc.doc.selfieDesc', icon: 'camera' },
};

export default function KycScreen() {
  return (
    <AuthGate>
      <KycScreenContent />
    </AuthGate>
  );
}

function KycScreenContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslate();
  const rtl = useIsRtl();
  const { user, updateUser } = useAuthStore();

  const [photos, setPhotos] = useState<Record<DocKey, ImagePicker.ImagePickerAsset | null>>({
    idFront: null,
    idBack: null,
    selfie: null,
  });

  const { data: kycStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['kycStatus'],
    queryFn: () => kycApi.getStatus(),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const idFront = photos.idFront;
      const idBack = photos.idBack;
      const selfie = photos.selfie;
      if (!idFront || !idBack || !selfie) {
        throw new Error(t('kyc.doc.idFront'));
      }
      const { prepareImageForUpload } = await import('../lib/utils/prepare-upload-image');
      const [front, back, face] = await Promise.all([
        prepareImageForUpload({
          uri: idFront.uri,
          width: idFront.width,
          height: idFront.height,
          kind: 'kyc',
        }),
        prepareImageForUpload({
          uri: idBack.uri,
          width: idBack.width,
          height: idBack.height,
          kind: 'kyc',
        }),
        prepareImageForUpload({
          uri: selfie.uri,
          width: selfie.width,
          height: selfie.height,
          kind: 'kyc',
        }),
      ]);
      return kycApi.submit({
        idFront: { uri: front.uri, name: front.name, type: front.type },
        idBack: { uri: back.uri, name: back.name, type: back.type },
        selfie: { uri: face.uri, name: face.name, type: face.type },
      });
    },
    onSuccess: async () => {
      try {
        const profile = await authApi.getProfile();
        updateUser(profile);
      } catch {
        /* ignore */
      }
      queryClient.invalidateQueries({ queryKey: ['kycStatus'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      Alert.alert(t('kyc.successTitle'), t('kyc.successBody'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    },
    onError: (err: unknown) => {
      const pres = getErrorPresentation(err, t);
      Alert.alert(t('submit.failed'), pres.message);
    },
  });

  const pickImage = async (key: DocKey) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('kyc.permission.library'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      aspect: key === 'selfie' ? [1, 1] : [3, 2],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => ({ ...prev, [key]: result.assets[0] }));
    }
  };

  const takePhoto = async (key: DocKey) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('kyc.permission.camera'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
      aspect: key === 'selfie' ? [1, 1] : [3, 2],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => ({ ...prev, [key]: result.assets[0] }));
    }
  };

  const allPhotosSelected = useMemo(() => DOC_KEYS.every((k) => photos[k] !== null), [photos]);
  const status = user?.verificationStatus || kycStatus?.verificationStatus || 'UNVERIFIED';
  const isSubmitting = submitMutation.isPending;

  if (loadingStatus) {
    return <LoadingState />;
  }

  if (status === 'VERIFIED') {
    return (
      <ScreenSurface style={styles.centered}>
        <View style={styles.iconCircleGreen}>
          <Ionicons name="shield-checkmark" size={56} color={Colors.green[600]} />
        </View>
        <Text style={styles.stateTitle}>{t('kyc.verifiedTitle')}</Text>
        <Text style={styles.stateBody}>{t('kyc.verifiedBody')}</Text>
        <GovButton
          label={t('profile.submitComplaint')}
          onPress={() => router.replace('/(tabs)/submit')}
          icon="add-circle-outline"
          style={{ marginTop: Spacing.xl }}
        />
        <GovButton label={t('kyc.goBack')} onPress={() => router.back()} variant="outline" style={{ marginTop: Spacing.md }} />
      </ScreenSurface>
    );
  }

  if (status === 'PENDING' || kycStatus?.hasActiveSubmission) {
    return (
      <ScreenSurface style={styles.centered}>
        <View style={styles.iconCircleOrange}>
          <Ionicons name="time" size={56} color={Colors.orange[600]} />
        </View>
        <Text style={styles.stateTitle}>{t('kyc.pendingTitle')}</Text>
        <Text style={styles.stateBody}>{t('kyc.pendingBody')}</Text>
        <GovButton label={t('kyc.goBack')} onPress={() => router.back()} variant="outline" style={{ marginTop: Spacing.xl }} />
      </ScreenSurface>
    );
  }

  const isRejected = status === 'REJECTED';

  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <Ionicons name="shield-checkmark" size={36} color={Colors.brand[600]} />
        <Text style={[styles.heroTitle, textAlignStart(rtl)]}>{t('kyc.title')}</Text>
        <Text style={[styles.heroSub, textAlignStart(rtl)]}>{t('kyc.subtitle')}</Text>
      </View>

      <GovCard>
        <SectionHeader title={t('kyc.whyTitle')} />
        <Text style={[styles.infoBody, textAlignStart(rtl)]}>{t('kyc.whyBody')}</Text>
      </GovCard>

      <GovCard style={styles.gap}>
        <SectionHeader title={t('kyc.afterSubmitTitle')} />
        <Text style={[styles.infoBody, textAlignStart(rtl)]}>{t('kyc.afterSubmitBody')}</Text>
      </GovCard>

      {isRejected && kycStatus?.rejectionReason ? (
        <ErrorBanner title={t('kyc.rejectedTitle')} message={kycStatus.rejectionReason} variant="error" />
      ) : null}

      {DOC_KEYS.map((key) => {
        const meta = DOC_META[key];
        const selected = photos[key];
        return (
          <GovCard key={key} style={styles.gap}>
            <View style={[styles.docHeader, flexRow(rtl)]}>
              <Ionicons name={meta.icon} size={24} color={Colors.brand[600]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.docLabel, textAlignStart(rtl)]}>{t(meta.labelKey)}</Text>
                <Text style={[styles.docDesc, textAlignStart(rtl)]}>{t(meta.descKey)}</Text>
              </View>
              {selected ? <Ionicons name="checkmark-circle" size={22} color={Colors.green[600]} /> : null}
            </View>
            {selected ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: selected.uri }} style={styles.preview} />
                <Pressable
                  style={styles.previewRemove}
                  onPress={() => setPhotos((prev) => ({ ...prev, [key]: null }))}
                >
                  <Ionicons name="close-circle" size={28} color={Colors.red[500]} />
                </Pressable>
              </View>
            ) : (
              <View style={[styles.photoActions, flexRow(rtl)]}>
                <TouchableOpacity style={styles.addPhotoCard} onPress={() => takePhoto(key)}>
                  <Ionicons name="camera-outline" size={26} color={Colors.brand[600]} />
                  <Text style={styles.addPhotoText}>{t('submit.camera')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addPhotoCard} onPress={() => pickImage(key)}>
                  <Ionicons name="images-outline" size={26} color={Colors.brand[600]} />
                  <Text style={styles.addPhotoText}>{t('submit.gallery')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </GovCard>
        );
      })}

      <GovButton
        label={t('kyc.submit')}
        onPress={() => submitMutation.mutate()}
        disabled={!allPhotosSelected || isSubmitting}
        loading={isSubmitting}
        icon="cloud-upload-outline"
        style={styles.gap}
      />

      <Text style={[styles.disclaimer, textAlignStart(rtl)]}>{t('kyc.disclaimer')}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: { justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { alignItems: 'center', marginBottom: Spacing.lg },
  heroTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray[900], marginTop: Spacing.sm },
  heroSub: { fontSize: FontSize.sm, color: Colors.gray[600], marginTop: Spacing.xs, lineHeight: 20, textAlign: 'center' },
  gap: { marginTop: Spacing.md },
  infoBody: { fontSize: FontSize.sm, color: Colors.gray[600], lineHeight: 20 },
  docHeader: { alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  docLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  docDesc: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
  previewWrap: { position: 'relative', borderRadius: BorderRadius.md, overflow: 'hidden' },
  preview: { width: '100%', height: 180, borderRadius: BorderRadius.md },
  previewRemove: { position: 'absolute', top: 8, right: 8 },
  photoActions: { gap: Spacing.sm },
  addPhotoCard: {
    flex: 1,
    height: 96,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.brand[300],
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.white,
  },
  addPhotoText: { fontSize: FontSize.xs, color: Colors.brand[700], fontWeight: '600' },
  disclaimer: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: Spacing.lg, lineHeight: 18, textAlign: 'center' },
  iconCircleGreen: {
    backgroundColor: Colors.green[100],
    borderRadius: 999,
    padding: 20,
    marginBottom: Spacing.lg,
  },
  iconCircleOrange: {
    backgroundColor: Colors.orange[100],
    borderRadius: 999,
    padding: 20,
    marginBottom: Spacing.lg,
  },
  stateTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray[900], textAlign: 'center' },
  stateBody: {
    fontSize: FontSize.sm,
    color: Colors.gray[600],
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 22,
    maxWidth: 320,
  },
});
