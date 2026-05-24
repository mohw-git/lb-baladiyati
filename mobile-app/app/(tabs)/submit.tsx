import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView,
  ActivityIndicator, Image, Platform, FlatList, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { complaintsApi, categoriesApi } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { useAuthStore } from '../../lib/auth/store';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

/** Format API validation errors into a readable string */
function formatApiError(err: unknown): string {
  if (err instanceof ApiError) {
    // If there are field-level validation details, show them
    if (err.details && err.details.length > 0) {
      return err.details.map((d) => `• ${d.message}`).join('\n');
    }
    return err.message || 'Something went wrong';
  }
  if (err instanceof Error) return err.message;
  return 'Could not connect to server. Check your internet connection.';
}

export default function SubmitScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // KYC verification gate
  const verificationStatus = user?.verificationStatus;
  if (verificationStatus !== 'VERIFIED') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: Colors.white }}>
        <Ionicons name="shield-checkmark" size={64} color={Colors.orange[500]} />
        <Text style={{ fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray[900], marginTop: 16, textAlign: 'center' }}>
          Identity Verification Required
        </Text>
        <Text style={{ fontSize: FontSize.md, color: Colors.gray[500], textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
          You must verify your identity before submitting complaints.
          This helps ensure accountability and transparency in our municipal services.
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/kyc')}
          style={{ marginTop: 24, backgroundColor: Colors.brand[600], paddingHorizontal: 32, paddingVertical: 14, borderRadius: BorderRadius.lg }}
        >
          <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: '700' }}>
            {verificationStatus === 'PENDING' ? 'View Verification Status' : 'Verify Identity'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Fetch categories — handle both array and { data: [...] } shapes
  const { data: categoriesRaw, isLoading: loadingCats } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  });
  const categories: { id: string; name: string; icon?: string }[] = Array.isArray(categoriesRaw)
    ? categoriesRaw
    : (categoriesRaw as any)?.data ?? [];

  const selectedCat = categories.find((c) => c.id === categoryId);

  /** Validate inputs before sending to API */
  const validate = (): string | null => {
    if (!categoryId) return 'Please select a category.';
    if (!title.trim()) return 'Please enter a title.';
    if (title.trim().length < 5) return 'Title must be at least 5 characters.';
    if (!description.trim()) return 'Please enter a description.';
    if (description.trim().length < 10) return 'Description must be at least 10 characters.';
    return null;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const data = {
        title: title.trim(),
        description: description.trim(),
        categoryId,
        ...(location ? { latitude: location.latitude, longitude: location.longitude } : {}),
        ...(address ? { address: address.trim() } : {}),
      };

      if (images.length > 0) {
        const photos = images.map((img, i) => ({
          uri: img.uri,
          name: img.fileName || `photo_${Date.now()}_${i}.jpg`,
          type: img.mimeType || 'image/jpeg',
        }));
        return complaintsApi.createWithPhotos(data, photos);
      }

      return complaintsApi.create(data);
    },
    onSuccess: () => {
      Alert.alert('Success', 'Your complaint has been submitted!', [
        {
          text: 'OK',
          onPress: () => {
            queryClient.invalidateQueries({ queryKey: ['my-complaints'] });
            queryClient.invalidateQueries({ queryKey: ['complaints'] });
            setTitle('');
            setDescription('');
            setCategoryId('');
            setImages([]);
            setLocation(null);
            setAddress('');
            router.push('/(tabs)/complaints');
          },
        },
      ]);
    },
    onError: (err: unknown) => {
      Alert.alert('Submission Failed', formatApiError(err));
    },
  });

  const handleSubmit = () => {
    const error = validate();
    if (error) {
      Alert.alert('Please fix', error);
      return;
    }
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
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
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
        Alert.alert('Permission needed', 'Location access is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      const [geo] = await Location.reverseGeocodeAsync(loc.coords);
      if (geo) {
        setAddress([geo.street, geo.city, geo.region].filter(Boolean).join(', '));
      }
    } catch {
      Alert.alert('Error', 'Could not get location. Please try again.');
    } finally {
      setLoadingLocation(false);
    }
  };

  const canSubmit = title.trim().length >= 5 && description.trim().length >= 10 && categoryId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Report an Issue</Text>
      <Text style={styles.sub}>Help improve your municipality by reporting problems.</Text>

      {/* Category picker button */}
      <Text style={styles.label}>Category *</Text>
      <TouchableOpacity style={styles.selectBtn} onPress={() => setShowCatPicker(true)} activeOpacity={0.7}>
        <Text style={selectedCat ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
          {loadingCats ? 'Loading...' : selectedCat ? selectedCat.name : 'Select a category'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.gray[400]} />
      </TouchableOpacity>

      {/* Category picker modal — proper scrollable list */}
      <Modal visible={showCatPicker} transparent animationType="fade" onRequestClose={() => setShowCatPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCatPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Category</Text>
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              style={styles.modalList}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, categoryId === item.id && styles.modalItemActive]}
                  onPress={() => { setCategoryId(item.id); setShowCatPicker(false); }}
                >
                  <Text style={[styles.modalItemText, categoryId === item.id && styles.modalItemTextActive]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {categoryId === item.id && <Ionicons name="checkmark-circle" size={20} color={Colors.brand[600]} />}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalEmpty}>No categories available.</Text>
              }
            />
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCatPicker(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Title */}
      <Text style={[styles.label, { marginTop: Spacing.lg }]}>Title * <Text style={styles.hint}>(min 5 chars)</Text></Text>
      <TextInput
        style={styles.textInput}
        value={title}
        onChangeText={setTitle}
        placeholder="Brief title of the issue"
        placeholderTextColor={Colors.gray[400]}
        maxLength={200}
      />
      {title.length > 0 && title.trim().length < 5 && (
        <Text style={styles.fieldError}>Title needs at least 5 characters ({title.trim().length}/5)</Text>
      )}

      {/* Description */}
      <Text style={[styles.label, { marginTop: Spacing.lg }]}>Description * <Text style={styles.hint}>(min 10 chars)</Text></Text>
      <TextInput
        style={[styles.textInput, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the problem in detail..."
        placeholderTextColor={Colors.gray[400]}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        maxLength={2000}
      />
      {description.length > 0 && description.trim().length < 10 && (
        <Text style={styles.fieldError}>Description needs at least 10 characters ({description.trim().length}/10)</Text>
      )}

      {/* Location */}
      <Text style={[styles.label, { marginTop: Spacing.lg }]}>Location (optional)</Text>
      <TouchableOpacity style={styles.locationBtn} onPress={getLocation} disabled={loadingLocation}>
        {loadingLocation ? (
          <ActivityIndicator size="small" color={Colors.brand[600]} />
        ) : (
          <Ionicons name="location" size={20} color={location ? Colors.green[500] : Colors.brand[600]} />
        )}
        <Text style={styles.locationText}>
          {location ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Get current location'}
        </Text>
        {location && (
          <TouchableOpacity onPress={() => { setLocation(null); setAddress(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close-circle" size={18} color={Colors.gray[400]} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {address ? <Text style={styles.addressText}>{address}</Text> : null}

      {/* Photos */}
      <Text style={[styles.label, { marginTop: Spacing.lg }]}>Photos ({images.length}/5)</Text>
      <View style={styles.photosRow}>
        {images.map((img, i) => (
          <View key={i} style={styles.photoWrap}>
            <Image source={{ uri: img.uri }} style={styles.photo} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => setImages(images.filter((_, idx) => idx !== i))}>
              <Ionicons name="close-circle" size={22} color={Colors.red[500]} />
            </TouchableOpacity>
          </View>
        ))}
        {images.length < 5 && (
          <View style={styles.addPhotoRow}>
            <TouchableOpacity style={styles.addPhotoBtn} onPress={pickImage}>
              <Ionicons name="images" size={24} color={Colors.brand[600]} />
              <Text style={styles.addPhotoText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addPhotoBtn} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color={Colors.brand[600]} />
              <Text style={styles.addPhotoText}>Camera</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit || submitMutation.isPending}
        activeOpacity={0.8}
      >
        {submitMutation.isPending ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <>
            <Ionicons name="send" size={18} color={Colors.white} style={{ marginRight: Spacing.sm }} />
            <Text style={styles.submitText}>Submit Complaint</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray[50] },
  content: { padding: Spacing.xl, paddingBottom: 60 },
  heading: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.gray[900] },
  sub: { fontSize: FontSize.sm, color: Colors.gray[500], marginTop: 2, marginBottom: Spacing.xl },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  hint: { fontWeight: '400', color: Colors.gray[400], fontSize: FontSize.xs },

  // Text inputs (NOT flex row)
  textInput: {
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white,
    fontSize: FontSize.md, color: Colors.gray[900],
  },
  textArea: { height: 110, textAlignVertical: 'top' },
  fieldError: { fontSize: FontSize.xs, color: Colors.red[500], marginTop: 4 },

  // Select button (flex row)
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white,
  },
  selectText: { fontSize: FontSize.md, color: Colors.gray[900], flex: 1, marginRight: Spacing.sm },
  selectPlaceholder: { fontSize: FontSize.md, color: Colors.gray[400], flex: 1, marginRight: Spacing.sm },

  // Category modal
  modalOverlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', padding: Spacing.xl,
  },
  modalContent: {
    width: '100%', maxHeight: '70%', backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg, overflow: 'hidden',
  },
  modalTitle: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.gray[900],
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: Spacing.md,
  },
  modalList: { maxHeight: 400 },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.lg,
  },
  modalItemActive: { backgroundColor: Colors.brand[50] },
  modalItemText: { fontSize: FontSize.md, color: Colors.gray[700], flex: 1 },
  modalItemTextActive: { color: Colors.brand[700], fontWeight: '600' },
  modalEmpty: { fontSize: FontSize.md, color: Colors.gray[400], textAlign: 'center', padding: Spacing.xl },
  separator: { height: 1, backgroundColor: Colors.gray[100], marginHorizontal: Spacing.xl },
  modalCancel: {
    borderTopWidth: 1, borderTopColor: Colors.gray[200],
    paddingVertical: Spacing.lg, alignItems: 'center',
  },
  modalCancelText: { fontSize: FontSize.md, color: Colors.gray[500], fontWeight: '600' },

  // Location
  locationBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    padding: Spacing.md, backgroundColor: Colors.white,
  },
  locationText: { fontSize: FontSize.sm, color: Colors.brand[600], flex: 1 },
  addressText: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: Spacing.xs },

  // Photos
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photoWrap: { position: 'relative' },
  photo: { width: 80, height: 80, borderRadius: BorderRadius.sm },
  photoRemove: { position: 'absolute', top: -6, right: -6 },
  addPhotoRow: { flexDirection: 'row', gap: Spacing.sm },
  addPhotoBtn: {
    width: 80, height: 80, borderRadius: BorderRadius.sm, borderWidth: 1.5, borderColor: Colors.brand[300],
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  addPhotoText: { fontSize: FontSize.xs, color: Colors.brand[600] },

  // Submit button
  submitBtn: {
    flexDirection: 'row', backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xxl,
    shadowColor: Colors.brand[900], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.white },
});
