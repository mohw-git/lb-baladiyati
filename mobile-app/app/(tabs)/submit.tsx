import { useState, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView,
  ActivityIndicator, Image, FlatList, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { complaintsApi, categoriesApi } from '../../lib/api/endpoints';
import { getErrorPresentation } from '../../lib/api/errors';
import { getCitizenSubmitPolicy } from '../../lib/citizen/submit-policy';
import { useAuthStore } from '../../lib/auth/store';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { useTranslate, useIsRtl, useLocale } from '../../lib/i18n';
import { pickName, type Locale } from '@shared/types/locale';
import {
  COMPLAINT_FIELD_LIMITS,
  isComplaintDescriptionValid,
  isComplaintTitleValid,
} from '@shared/constants/complaint-fields';
import {
  GovCard, GovButton, ErrorBanner, StepSection, TabScreenShell, CenteredStateCard,
} from '../../components/ui';
import { centeredText } from '../../lib/ui/rtl';
import { useTabScreenInsets } from '../../hooks/useTabScreenInsets';
import { flexRow, positionEnd, textAlignStart } from '../../lib/ui/rtl';

type MunicipalityCandidate = {
  id: string;
  name: string;
  code: string;
  nameAr?: string;
  nameFr?: string;
};

function formatMunicipalityLabel(c: MunicipalityCandidate, locale: Locale): string {
  const name = pickName(c, locale);
  return c.code ? `${name} (${c.code})` : name;
}

export default function SubmitScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const t = useTranslate();
  const locale = useLocale();
  const rtl = useIsRtl();
  const { contentPaddingBottom, horizontalPadding } = useTabScreenInsets();
  const policy = getCitizenSubmitPolicy(user);
  const verificationStatus = user?.verificationStatus;
  const resolveSeqRef = useRef(0);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [resolvingMunicipality, setResolvingMunicipality] = useState(false);
  const [resolveError, setResolveError] = useState(false);
  const [operationalMunicipalityId, setOperationalMunicipalityId] = useState<string | undefined>();
  const [resolutionStatus, setResolutionStatus] = useState<string | null>(null);
  const [resolutionCandidates, setResolutionCandidates] = useState<MunicipalityCandidate[]>([]);
  const [selectedMunicipalityId, setSelectedMunicipalityId] = useState('');
  const [reportingMunicipalityName, setReportingMunicipalityName] = useState<string | null>(null);

  const categoryMunicipalityId = operationalMunicipalityId;

  const { data: categoriesRaw, isLoading: loadingCats } = useQuery({
    queryKey: ['categories', categoryMunicipalityId ?? 'home'],
    queryFn: () => categoriesApi.list(categoryMunicipalityId),
    enabled: policy.canSubmit && !!categoryMunicipalityId,
  });
  const categories: { id: string; name: string }[] = Array.isArray(categoriesRaw)
    ? categoriesRaw
    : (categoriesRaw as any)?.data ?? [];

  const selectedCat = categories.find((c) => c.id === categoryId);

  const municipalityReady =
    !!operationalMunicipalityId &&
    resolutionStatus !== 'OUT_OF_COVERAGE' &&
    (resolutionStatus !== 'AMBIGUOUS' || !!selectedMunicipalityId);

  const validate = (): string | null => {
    if (!location) return t('submit.validation.locationRequired');
    if (resolveError) return t('submit.routing.resolveFailed');
    if (resolvingMunicipality) return t('submit.routing.resolving');
    if (resolutionStatus === 'OUT_OF_COVERAGE') return t('submit.routing.outOfCoverage');
    if (!operationalMunicipalityId) {
      if (resolutionStatus === 'AMBIGUOUS' && !selectedMunicipalityId) {
        return t('submit.validation.municipality');
      }
      return t('submit.validation.locationRequired');
    }
    if (!categoryId) return t('submit.validation.category');
    if (!title.trim()) return t('submit.validation.titleRequired');
    if (!isComplaintTitleValid(title)) return t('submit.validation.titleRange');
    if (!description.trim()) return t('submit.validation.descriptionRequired');
    if (!isComplaintDescriptionValid(description)) return t('submit.validation.descriptionRange');
    if (resolutionStatus === 'AMBIGUOUS' && !selectedMunicipalityId) {
      return t('submit.validation.municipality');
    }
    return null;
  };

  const resetRoutingState = useCallback(() => {
    setOperationalMunicipalityId(undefined);
    setSelectedMunicipalityId('');
    setResolutionCandidates([]);
    setResolutionStatus(null);
    setReportingMunicipalityName(null);
    setCategoryId('');
    setResolveError(false);
  }, []);

  const clearLocation = useCallback(() => {
    resolveSeqRef.current += 1;
    setLocation(null);
    setAddress('');
    setResolvingMunicipality(false);
    resetRoutingState();
  }, [resetRoutingState]);

  const resolveIncidentMunicipality = useCallback(
    async (lat: number, lng: number) => {
      const seq = ++resolveSeqRef.current;
      setResolvingMunicipality(true);
      setResolveError(false);
      try {
        const res = await complaintsApi.resolveLocation(lat, lng);
        if (seq !== resolveSeqRef.current) return;

        setResolutionStatus(res.status);
        setResolutionCandidates(res.candidates ?? []);

        if (res.status === 'OUT_OF_COVERAGE') {
          setOperationalMunicipalityId(undefined);
          setReportingMunicipalityName(null);
          setCategoryId('');
          setSelectedMunicipalityId('');
          return;
        }
        if (res.status === 'AMBIGUOUS') {
          setOperationalMunicipalityId(undefined);
          setReportingMunicipalityName(null);
          setCategoryId('');
          setSelectedMunicipalityId('');
          return;
        }
        if (res.municipalityId) {
          setOperationalMunicipalityId(res.municipalityId);
          setSelectedMunicipalityId('');
          const match = res.candidates?.find((c) => c.id === res.municipalityId);
          setReportingMunicipalityName(match ? pickName(match, locale) : null);
          setCategoryId('');
        }
      } catch {
        if (seq !== resolveSeqRef.current) return;
        setResolveError(true);
        setResolutionStatus(null);
        setOperationalMunicipalityId(undefined);
        setReportingMunicipalityName(null);
        setResolutionCandidates([]);
        setSelectedMunicipalityId('');
        setCategoryId('');
      } finally {
        if (seq === resolveSeqRef.current) {
          setResolvingMunicipality(false);
        }
      }
    },
    [locale],
  );

  const retryResolve = useCallback(() => {
    if (location) {
      void resolveIncidentMunicipality(location.latitude, location.longitude);
    }
  }, [location, resolveIncidentMunicipality]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!location) {
        throw new Error(t('submit.validation.locationRequired'));
      }
      const data = {
        title: title.trim(),
        description: description.trim(),
        categoryId,
        latitude: location.latitude,
        longitude: location.longitude,
        ...(address ? { address: address.trim() } : {}),
        ...(selectedMunicipalityId ? { selectedMunicipalityId } : {}),
      };
      if (images.length > 0) {
        const { prepareImagesForUpload } = await import('../../lib/utils/prepare-upload-image');
        const prepared = await prepareImagesForUpload(
          images.map((img) => ({
            uri: img.uri,
            width: img.width,
            height: img.height,
          })),
          'complaint',
        );
        const photos = prepared.map((p) => ({
          uri: p.uri,
          name: p.name,
          type: p.type,
        }));
        return complaintsApi.createWithPhotos(data, photos);
      }
      return complaintsApi.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      Alert.alert(t('common.success'), t('submit.successDetail'), [
        {
          text: t('common.ok'),
          onPress: () => {
            setTitle('');
            setDescription('');
            setCategoryId('');
            setImages([]);
            clearLocation();
            router.push('/(tabs)/complaints');
          },
        },
      ]);
    },
    onError: (err: unknown) => {
      Alert.alert(t('submit.failed'), getErrorPresentation(err, t).message);
    },
  });

  const handleSubmit = () => {
    const err = validate();
    if (err) {
      Alert.alert(t('common.error'), err);
      return;
    }
    if (submitMutation.isPending) return;
    submitMutation.mutate();
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 5 - images.length,
    });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets].slice(0, 5));
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('submit.permission.camera'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setImages((prev) => [...prev, ...result.assets].slice(0, 5));
    }
  };

  const getLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.error'), t('submit.permission.location'));
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setLocation(coords);
      resetRoutingState();
      await resolveIncidentMunicipality(coords.latitude, coords.longitude);
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      if (geo) {
        setAddress([geo.street, geo.city, geo.region].filter(Boolean).join(', '));
      }
    } catch {
      Alert.alert(t('common.error'), t('submit.locationError'));
    } finally {
      setLoadingLocation(false);
    }
  };

  const pickAmbiguousMunicipality = (c: MunicipalityCandidate) => {
    setSelectedMunicipalityId(c.id);
    setOperationalMunicipalityId(c.id);
    setReportingMunicipalityName(pickName(c, locale));
    setCategoryId('');
  };

  const canSubmit =
    !!location &&
    !resolvingMunicipality &&
    !resolveError &&
    municipalityReady &&
    resolutionStatus !== 'OUT_OF_COVERAGE' &&
    isComplaintTitleValid(title) &&
    isComplaintDescriptionValid(description) &&
    !!categoryId &&
    !submitMutation.isPending;

  if (policy.blockedByVerification) {
    const blockedMessage = policy.emailUnverified && policy.kycUnverified
      ? t('submit.blocked.both')
      : policy.emailUnverified
        ? t('submit.blocked.email')
        : t('submit.blocked.kyc');
    return (
      <TabScreenShell centerContent>
        <CenteredStateCard>
          <Ionicons name="shield-checkmark" size={48} color={Colors.orange[500]} />
          <Text style={[styles.blockedTitle, centeredText]}>{t('submit.blocked.title')}</Text>
          <Text style={[styles.blockedBody, centeredText]}>{blockedMessage}</Text>
          {policy.kycUnverified && (
            <GovButton
              label={
                verificationStatus === 'PENDING'
                  ? t('profile.verifyPending')
                  : t('profile.verifyMissing')
              }
              onPress={() => router.push('/kyc')}
              variant="outline"
              style={styles.blockedBtn}
            />
          )}
          <GovButton
            label={t('tabs.profile')}
            onPress={() => router.push('/(tabs)/profile')}
            variant="outline"
            style={styles.blockedBtn}
          />
        </CenteredStateCard>
      </TabScreenShell>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingHorizontal: horizontalPadding,
          paddingBottom: contentPaddingBottom,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageIntro}>
        <Text style={[styles.heading, textAlignStart(rtl)]}>{t('submit.title')}</Text>
        <Text style={[styles.sub, textAlignStart(rtl)]}>{t('submit.subtitle')}</Text>
        <Text style={[styles.routingIntro, textAlignStart(rtl)]}>
          {t('submit.routing.locationIntro')}
        </Text>
      </View>

      {policy.showUnverifiedWarning && (
        <ErrorBanner title={t('home.verification.warningTitle')} message={t('submit.warning.unverified')} variant="info" />
      )}

      <StepSection step={1} title={t('submit.section.location')} rtl={rtl}>
        <TouchableOpacity style={[styles.locationBtn, flexRow(rtl)]} onPress={getLocation} disabled={loadingLocation || resolvingMunicipality}>
          {loadingLocation ? (
            <ActivityIndicator size="small" color={Colors.brand[600]} />
          ) : (
            <Ionicons name="location" size={20} color={location ? Colors.cedar[600] : Colors.brand[600]} />
          )}
          <Text style={[styles.locationText, { flex: 1, textAlign: rtl ? 'right' : 'left' }]}>
            {location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : t('submit.getLocation')}
          </Text>
          {location ? (
            <TouchableOpacity
              onPress={clearLocation}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={18} color={Colors.gray[400]} />
            </TouchableOpacity>
          ) : null}
        </TouchableOpacity>
        {address ? <Text style={[styles.addressText, textAlignStart(rtl)]}>{address}</Text> : null}
      </StepSection>

      <StepSection step={2} title={t('submit.section.municipality')} rtl={rtl} style={styles.sectionGap}>
        {!location ? (
          <Text style={[styles.muniHint, textAlignStart(rtl)]}>{t('submit.category.locked')}</Text>
        ) : null}

        {location && resolvingMunicipality ? (
          <View style={[styles.resolvingRow, flexRow(rtl)]}>
            <ActivityIndicator size="small" color={Colors.brand[600]} />
            <Text style={[styles.resolvingText, textAlignStart(rtl)]}>{t('submit.routing.resolving')}</Text>
          </View>
        ) : null}

        {location && resolveError ? (
          <View>
            <ErrorBanner
              title={t('common.error')}
              message={t('submit.routing.resolveFailed')}
              variant="error"
            />
            <GovButton
              label={t('submit.routing.retry')}
              onPress={retryResolve}
              variant="outline"
              style={styles.retryBtn}
            />
          </View>
        ) : null}

        {resolutionStatus === 'OUT_OF_COVERAGE' ? (
          <ErrorBanner
            title={t('common.error')}
            message={t('submit.routing.outOfCoverage')}
            variant="error"
          />
        ) : null}

        {reportingMunicipalityName && municipalityReady ? (
          <GovCard style={styles.routingCard}>
            <Text style={[styles.routingTitle, textAlignStart(rtl)]}>
              {t('submit.routing.reportingTo', { name: reportingMunicipalityName })}
            </Text>
            {user?.municipalityId && operationalMunicipalityId && user.municipalityId !== operationalMunicipalityId ? (
              <Text style={[styles.routingHint, textAlignStart(rtl)]}>
                {t('submit.routing.crossMunicipality', { name: reportingMunicipalityName })}
              </Text>
            ) : null}
          </GovCard>
        ) : null}

        {resolutionStatus === 'AMBIGUOUS' && resolutionCandidates.length > 0 ? (
          <GovCard style={styles.routingCard}>
            <Text style={[styles.routingTitle, textAlignStart(rtl)]}>{t('submit.routing.ambiguousTitle')}</Text>
            {resolutionCandidates.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.muniOption,
                  selectedMunicipalityId === c.id && styles.muniOptionSelected,
                  flexRow(rtl),
                ]}
                onPress={() => pickAmbiguousMunicipality(c)}
              >
                <Text style={textAlignStart(rtl)}>{formatMunicipalityLabel(c, locale)}</Text>
              </TouchableOpacity>
            ))}
          </GovCard>
        ) : null}
      </StepSection>

      <StepSection step={3} title={t('submit.section.category')} rtl={rtl} style={styles.sectionGap}>
        <TouchableOpacity
          style={[styles.selectBtn, flexRow(rtl), !municipalityReady && styles.selectBtnDisabled]}
          onPress={() => municipalityReady && setShowCatPicker(true)}
          disabled={!municipalityReady || resolvingMunicipality}
        >
          <Text
            style={[
              selectedCat ? styles.selectText : styles.selectPlaceholder,
              textAlignStart(rtl),
              { flex: 1 },
            ]}
            numberOfLines={1}
          >
            {!municipalityReady
              ? t('submit.category.locked')
              : loadingCats
                ? t('common.loading')
                : selectedCat
                  ? selectedCat.name
                  : t('submit.selectCategory')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={Colors.gray[400]} />
        </TouchableOpacity>
      </StepSection>

      <StepSection step={4} title={t('submit.section.details')} rtl={rtl} style={styles.sectionGap}>
        <Text style={[styles.fieldLabel, textAlignStart(rtl)]}>{t('submit.field.title')}</Text>
        <Text style={[styles.fieldHint, textAlignStart(rtl)]}>{t('submit.field.title.hint')}</Text>
        <TextInput
          style={[styles.textInput, textAlignStart(rtl)]}
          value={title}
          onChangeText={setTitle}
          placeholder={t('submit.placeholder.title')}
          placeholderTextColor={Colors.gray[400]}
          maxLength={COMPLAINT_FIELD_LIMITS.title.max}
        />
        <Text style={[styles.charCount, textAlignStart(rtl)]}>
          {t('submit.field.charCount', {
            current: String(title.length),
            max: String(COMPLAINT_FIELD_LIMITS.title.max),
          })}
        </Text>
        {title.length > 0 && !isComplaintTitleValid(title) && (
          <Text style={[styles.fieldError, textAlignStart(rtl)]}>{t('submit.validation.titleRange')}</Text>
        )}

        <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }, textAlignStart(rtl)]}>
          {t('submit.field.description')}
        </Text>
        <Text style={[styles.fieldHint, textAlignStart(rtl)]}>{t('submit.field.description.hint')}</Text>
        <TextInput
          style={[styles.textInput, styles.textArea, textAlignStart(rtl)]}
          value={description}
          onChangeText={setDescription}
          placeholder={t('submit.placeholder.description')}
          placeholderTextColor={Colors.gray[400]}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          maxLength={COMPLAINT_FIELD_LIMITS.description.max}
        />
        <Text style={[styles.charCount, textAlignStart(rtl)]}>
          {t('submit.field.charCount', {
            current: String(description.length),
            max: String(COMPLAINT_FIELD_LIMITS.description.max),
          })}
        </Text>
        {description.length > 0 && !isComplaintDescriptionValid(description) && (
          <Text style={[styles.fieldError, textAlignStart(rtl)]}>
            {t('submit.validation.descriptionRange')}
          </Text>
        )}
      </StepSection>

      <StepSection
        step={5}
        title={t('submit.section.photos', { count: String(images.length) })}
        rtl={rtl}
        style={styles.sectionGap}
      >
        <View style={[styles.photosGrid, flexRow(rtl)]}>
          {images.map((img, i) => (
            <View key={i} style={styles.photoCard}>
              <Image source={{ uri: img.uri }} style={styles.photo} />
              <TouchableOpacity
                style={[styles.photoRemove, positionEnd(rtl, 4)]}
                onPress={() => setImages(images.filter((_, idx) => idx !== i))}
              >
                <Ionicons name="close-circle" size={22} color={Colors.red[500]} />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < 5 && (
            <>
              <TouchableOpacity style={styles.addPhotoCard} onPress={pickImage}>
                <Ionicons name="images-outline" size={26} color={Colors.brand[600]} />
                <Text style={styles.addPhotoText}>{t('submit.gallery')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addPhotoCard} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={26} color={Colors.brand[600]} />
                <Text style={styles.addPhotoText}>{t('submit.camera')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </StepSection>

      <GovCard style={styles.sectionGap}>
        <Text style={[styles.reviewHint, textAlignStart(rtl)]}>{t('submit.reviewHint')}</Text>
        <GovButton
          label={t('submit.submitButton')}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitMutation.isPending}
          icon="paper-plane-outline"
        />
      </GovCard>

      <Modal visible={showCatPicker} transparent animationType="fade" onRequestClose={() => setShowCatPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCatPicker(false)}>
          <View style={styles.modalBox}>
            <Text style={[styles.modalTitle, textAlignStart(rtl)]}>{t('submit.selectCategory')}</Text>
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              style={styles.modalList}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, flexRow(rtl), categoryId === item.id && styles.modalItemActive]}
                  onPress={() => { setCategoryId(item.id); setShowCatPicker(false); }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      textAlignStart(rtl),
                      { flex: 1 },
                      categoryId === item.id && styles.modalItemTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {categoryId === item.id && (
                    <Ionicons name="checkmark-circle" size={20} color={Colors.brand[600]} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.modalEmpty}>{t('submit.noCategories')}</Text>}
            />
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCatPicker(false)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { paddingTop: Spacing.md },
  pageIntro: {
    backgroundColor: Colors.navy[900],
    marginHorizontal: -16,
    marginTop: -Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  heading: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.white },
  sub: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: Spacing.xs, lineHeight: 22 },
  routingIntro: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.9)',
    marginTop: Spacing.sm,
    lineHeight: 20,
  },
  routingCard: { marginTop: Spacing.sm },
  routingTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.navy[900] },
  routingHint: { fontSize: FontSize.xs, color: Colors.gray[600], marginTop: Spacing.xs, lineHeight: 18 },
  muniHint: { fontSize: FontSize.sm, color: Colors.gray[500], lineHeight: 20 },
  resolvingRow: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  resolvingText: { fontSize: FontSize.sm, color: Colors.brand[700], flex: 1 },
  retryBtn: { marginTop: Spacing.sm },
  muniOption: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.white,
  },
  muniOptionSelected: { borderColor: Colors.brand[600], backgroundColor: Colors.brand[50] },
  sectionGap: { marginTop: Spacing.md },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  fieldHint: { fontSize: FontSize.xs, color: Colors.gray[500], marginBottom: Spacing.xs },
  charCount: { fontSize: FontSize.xs, color: Colors.gray[400], marginTop: 4 },
  textInput: {
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white,
    fontSize: FontSize.md, color: Colors.gray[900],
  },
  textArea: { minHeight: 110, textAlignVertical: 'top' },
  fieldError: { fontSize: FontSize.xs, color: Colors.red[500], marginTop: 4 },
  selectBtn: {
    alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white,
  },
  selectBtnDisabled: { backgroundColor: Colors.gray[50], opacity: 0.85 },
  selectText: { fontSize: FontSize.md, color: Colors.gray[900], flex: 1 },
  selectPlaceholder: { fontSize: FontSize.md, color: Colors.gray[400], flex: 1 },
  locationBtn: {
    alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    padding: Spacing.md, backgroundColor: Colors.white,
  },
  locationText: { fontSize: FontSize.sm, color: Colors.brand[700] },
  addressText: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: Spacing.sm },
  photosGrid: { flexWrap: 'wrap', gap: Spacing.sm },
  photoCard: { position: 'relative', borderRadius: BorderRadius.md, overflow: 'hidden' },
  photo: { width: 96, height: 96, borderRadius: BorderRadius.md },
  photoRemove: { position: 'absolute', top: 4 },
  addPhotoCard: {
    width: 96, height: 96, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.brand[300],
    justifyContent: 'center', alignItems: 'center', gap: 4, backgroundColor: Colors.white,
  },
  addPhotoText: { fontSize: FontSize.xs, color: Colors.brand[700], fontWeight: '600' },
  reviewHint: { fontSize: FontSize.sm, color: Colors.gray[600], marginBottom: Spacing.lg, lineHeight: 20 },
  modalOverlay: {
    flex: 1, justifyContent: 'center', backgroundColor: 'rgba(12,26,46,0.5)', padding: Spacing.xl,
  },
  modalBox: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, maxHeight: '70%', overflow: 'hidden' },
  modalTitle: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900],
    padding: Spacing.xl, paddingBottom: Spacing.md,
  },
  modalList: { maxHeight: 360 },
  modalItem: {
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
  },
  modalItemActive: { backgroundColor: Colors.brand[50] },
  modalItemText: { fontSize: FontSize.md, color: Colors.gray[700], flex: 1 },
  modalItemTextActive: { color: Colors.brand[700], fontWeight: '600' },
  modalEmpty: { textAlign: 'center', padding: Spacing.xl, color: Colors.gray[400] },
  separator: { height: 1, backgroundColor: Colors.gray[100], marginHorizontal: Spacing.xl },
  modalCancel: { borderTopWidth: 1, borderTopColor: Colors.gray[200], padding: Spacing.lg, alignItems: 'center' },
  modalCancelText: { fontSize: FontSize.md, color: Colors.gray[600], fontWeight: '600' },
  blockedTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.gray[900],
    marginTop: Spacing.sm,
    alignSelf: 'stretch',
  },
  blockedBody: {
    fontSize: FontSize.sm,
    color: Colors.gray[500],
    marginTop: Spacing.xs,
    lineHeight: 20,
    alignSelf: 'stretch',
  },
  blockedBtn: { marginTop: Spacing.sm, maxWidth: 280, alignSelf: 'center' },
});
