import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView,
  ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { kycApi, authApi } from '../lib/api/endpoints';
import { ApiError } from '../lib/api/client';
import { useAuthStore } from '../lib/auth/store';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

type DocKey = 'idFront' | 'idBack' | 'selfie';

interface DocConfig {
  key: DocKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  description: string;
}

const DOCS: DocConfig[] = [
  { key: 'idFront', label: 'ID Card (Front)', icon: 'card', description: 'Front side of your national ID' },
  { key: 'idBack', label: 'ID Card (Back)', icon: 'card-outline', description: 'Back side of your national ID' },
  { key: 'selfie', label: 'Selfie Photo', icon: 'camera', description: 'Clear photo of your face' },
];

export default function KycScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
    mutationFn: () => {
      const payload: any = {};
      for (const doc of DOCS) {
        const p = photos[doc.key];
        if (!p) throw new Error(`${doc.label} is required`);
        payload[doc.key] = {
          uri: p.uri,
          name: `${doc.key}.${p.uri.split('.').pop() || 'jpg'}`,
          type: p.mimeType || 'image/jpeg',
        };
      }
      return kycApi.submit(payload);
    },
    onSuccess: async () => {
      // Refresh profile to get updated verification status
      try {
        const profile = await authApi.getProfile();
        updateUser(profile);
      } catch {}
      queryClient.invalidateQueries({ queryKey: ['kycStatus'] });
      Alert.alert(
        'Documents Submitted',
        'Your identity verification documents have been submitted for review. You will be notified of the result.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    },
    onError: (err: any) => {
      const message = err instanceof ApiError
        ? err.message
        : 'Failed to submit documents. Please try again.';
      Alert.alert('Submission Failed', message);
    },
  });

  const pickImage = async (key: DocKey) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
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
      Alert.alert('Permission Required', 'Please allow access to your camera.');
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

  const allPhotosSelected = DOCS.every((d) => photos[d.key] !== null);
  const status = user?.verificationStatus || kycStatus?.verificationStatus || 'UNVERIFIED';

  if (loadingStatus) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.brand[600]} />
      </View>
    );
  }

  // Already verified
  if (status === 'VERIFIED') {
    return (
      <View style={styles.center}>
        <View style={{ 
          backgroundColor: Colors.green[100], 
          borderRadius: 999, 
          padding: 20, 
          marginBottom: 16,
        }}>
          <Ionicons name="shield-checkmark" size={64} color={Colors.green[600]} />
        </View>
        <Text style={styles.verifiedTitle}>Account Verified!</Text>
        <Text style={styles.verifiedSubtitle}>
          Your identity has been successfully verified by our team. You now have full access to all municipal services.
        </Text>
        
        <View style={{ 
          flexDirection: 'row', alignItems: 'center', 
          backgroundColor: Colors.green[50], 
          paddingHorizontal: 20, paddingVertical: 12, 
          borderRadius: BorderRadius.lg, marginTop: 24, 
          borderWidth: 1, borderColor: Colors.green[100],
        }}>
          <Ionicons name="checkmark-done" size={20} color={Colors.green[700]} />
          <Text style={{ marginLeft: 8, fontSize: FontSize.sm, color: Colors.green[700], fontWeight: '600' }}>
            You can now submit complaints
          </Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: Colors.brand[600], marginTop: 24 }]} 
          onPress={() => router.replace('/(tabs)/submit')}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={[styles.backBtnText, { color: '#fff' }]}>Submit a Complaint</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.backBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.gray[300] }]} 
          onPress={() => router.back()}
        >
          <Text style={[styles.backBtnText, { color: Colors.gray[700] }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Pending review
  if (status === 'PENDING' || kycStatus?.hasActiveSubmission) {
    return (
      <View style={styles.center}>
        <Ionicons name="time" size={80} color={Colors.orange[500]} />
        <Text style={styles.pendingTitle}>Under Review</Text>
        <Text style={styles.pendingSubtitle}>
          Your identity documents are being reviewed. This typically takes 1-2 business days.
          You will be notified of the result.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Rejected - allow re-submission
  const isRejected = status === 'REJECTED';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={40} color={Colors.brand[600]} />
        <Text style={styles.title}>Identity Verification</Text>
        <Text style={styles.subtitle}>
          To use municipal services, you must verify your identity by uploading your national ID
          and a selfie photo.
        </Text>
      </View>

      {isRejected && kycStatus?.rejectionReason && (
        <View style={styles.rejectionBanner}>
          <Ionicons name="alert-circle" size={20} color={Colors.red[700]} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.rejectionTitle}>Previous submission rejected</Text>
            <Text style={styles.rejectionReason}>{kycStatus.rejectionReason}</Text>
          </View>
        </View>
      )}

      {DOCS.map((doc) => (
        <View key={doc.key} style={styles.docCard}>
          <View style={styles.docHeader}>
            <Ionicons name={doc.icon} size={24} color={Colors.brand[600]} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.docLabel}>{doc.label}</Text>
              <Text style={styles.docDesc}>{doc.description}</Text>
            </View>
            {photos[doc.key] && (
              <Ionicons name="checkmark-circle" size={22} color={Colors.green[600]} />
            )}
          </View>

          {photos[doc.key] ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photos[doc.key]!.uri }} style={styles.preview} />
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => setPhotos((prev) => ({ ...prev, [doc.key]: null }))}
              >
                <Ionicons name="close-circle" size={28} color={Colors.red[500]} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => takePhoto(doc.key)}>
                <Ionicons name="camera" size={20} color={Colors.brand[600]} />
                <Text style={styles.actionBtnText}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => pickImage(doc.key)}>
                <Ionicons name="image" size={20} color={Colors.brand[600]} />
                <Text style={styles.actionBtnText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={[styles.submitBtn, (!allPhotosSelected || submitMutation.isPending) && styles.submitBtnDisabled]}
        disabled={!allPhotosSelected || submitMutation.isPending}
        onPress={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="cloud-upload" size={20} color="#fff" />
            <Text style={styles.submitBtnText}>Submit for Verification</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={styles.disclaimer}>
        Your documents will be securely stored and reviewed by authorized municipal personnel only.
        The selfie will be used as your profile photo.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl, backgroundColor: Colors.white },
  header: { alignItems: 'center', marginBottom: Spacing.xxl },
  title: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.gray[900], marginTop: Spacing.md },
  subtitle: { fontSize: FontSize.md, color: Colors.gray[500], textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
  rejectionBanner: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.red[50],
    borderWidth: 1, borderColor: Colors.red[200], borderRadius: BorderRadius.md,
    padding: Spacing.lg, marginBottom: Spacing.lg,
  },
  rejectionTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.red[700] },
  rejectionReason: { fontSize: FontSize.sm, color: Colors.red[600], marginTop: 4 },
  docCard: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.lg,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.gray[200],
  },
  docHeader: { flexDirection: 'row', alignItems: 'center' },
  docLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[900] },
  docDesc: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: 2 },
  previewContainer: { marginTop: Spacing.md, position: 'relative' },
  preview: { width: '100%', height: 180, borderRadius: BorderRadius.md, resizeMode: 'cover' },
  removeBtn: { position: 'absolute', top: 8, right: 8 },
  actionRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: Spacing.md, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.brand[200], borderStyle: 'dashed',
    backgroundColor: Colors.brand[50],
  },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[600] },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.brand[600], paddingVertical: 16, borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
  disclaimer: { fontSize: FontSize.xs, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.lg, lineHeight: 18 },
  verifiedTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.gray[900], marginTop: Spacing.lg },
  verifiedSubtitle: { fontSize: FontSize.md, color: Colors.gray[500], textAlign: 'center', marginTop: Spacing.sm },
  pendingTitle: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.gray[900], marginTop: Spacing.lg },
  pendingSubtitle: { fontSize: FontSize.md, color: Colors.gray[500], textAlign: 'center', marginTop: Spacing.sm, lineHeight: 22 },
  backBtn: { marginTop: Spacing.xxl, paddingHorizontal: 32, paddingVertical: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.brand[600] },
  backBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
});
