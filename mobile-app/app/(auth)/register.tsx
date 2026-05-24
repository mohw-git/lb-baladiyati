import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/auth/store';
import { authApi, municipalitiesApi } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

interface Municipality { id: string; name: string; code: string; }

export default function RegisterScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedMuni, setSelectedMuni] = useState<Municipality | null>(null);
  const [showMuniPicker, setShowMuniPicker] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMunis, setLoadingMunis] = useState(true);
  const [muniError, setMuniError] = useState('');

  const fetchMunicipalities = useCallback(() => {
    setLoadingMunis(true);
    setMuniError('');
    municipalitiesApi.list()
      .then((data: unknown) => {
        // Handle both array and { data: [...] } formats
        let list: Municipality[] = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
          list = (data as any).data;
        }
        setMunicipalities(list);
        if (list.length === 1) setSelectedMuni(list[0]);
        if (list.length === 0) setMuniError('No municipalities found');
      })
      .catch((err: any) => {
        console.log('Failed to load municipalities:', err);
        setMuniError('Failed to load municipalities. Check your connection.');
      })
      .finally(() => setLoadingMunis(false));
  }, []);

  useEffect(() => {
    fetchMunicipalities();
  }, [fetchMunicipalities]);

  const handleRegister = async () => {
    if (!selectedMuni || !firstName || !lastName || !email || !password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.register({
        municipalityCode: selectedMuni.code,
        email,
        password,
        firstName,
        lastName,
        phone: phone || undefined,
      });
      await setAuth(
        {
          ...res.user,
          roles: res.user?.roles ?? [],
          permissions: res.user?.permissions ?? [],
        },
        res.accessToken,
        res.refreshToken,
      );
      router.replace('/(tabs)');
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        Alert.alert('Registration Failed', err.details.map((d: any) => `• ${d.message}`).join('\n'));
      } else {
        Alert.alert('Registration Failed', err instanceof Error ? err.message : 'Could not connect to server');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBox}>
          <Ionicons name="person-add" size={36} color={Colors.white} />
        </View>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join your municipality on Baladi</Text>

        <View style={styles.card}>
          {/* Municipality */}
          <Text style={styles.label}>Municipality *</Text>
          {loadingMunis ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.brand[600]} />
              <Text style={styles.loadingText}>Loading municipalities...</Text>
            </View>
          ) : muniError ? (
            <View>
              <Text style={styles.errorText}>{muniError}</Text>
              <TouchableOpacity onPress={fetchMunicipalities} style={styles.retryBtn}>
                <Ionicons name="refresh" size={16} color={Colors.brand[600]} />
                <Text style={styles.retryText}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity style={styles.selectInput} onPress={() => setShowMuniPicker(!showMuniPicker)}>
                <Text style={selectedMuni ? styles.inputText : styles.placeholder}>
                  {selectedMuni ? `${selectedMuni.name} (${selectedMuni.code})` : 'Select municipality'}
                </Text>
                <Ionicons name={showMuniPicker ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray[400]} />
              </TouchableOpacity>
              {showMuniPicker && (
                <View style={styles.picker}>
                  {municipalities.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.pickerItem, selectedMuni?.id === m.id && styles.pickerItemActive]}
                      onPress={() => { setSelectedMuni(m); setShowMuniPicker(false); }}
                    >
                      <Text style={[styles.pickerText, selectedMuni?.id === m.id && { color: Colors.brand[700], fontWeight: '600' }]}>
                        {m.name} ({m.code})
                      </Text>
                      {selectedMuni?.id === m.id && (
                        <Ionicons name="checkmark" size={18} color={Colors.brand[700]} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* Name row */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { marginTop: Spacing.lg }]}>First Name *</Text>
              <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholder="John" placeholderTextColor={Colors.gray[400]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { marginTop: Spacing.lg }]}>Last Name *</Text>
              <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholder="Doe" placeholderTextColor={Colors.gray[400]} />
            </View>
          </View>

          {/* Email */}
          <Text style={[styles.label, { marginTop: Spacing.lg }]}>Email *</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="john@example.com" placeholderTextColor={Colors.gray[400]} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />

          {/* Phone */}
          <Text style={[styles.label, { marginTop: Spacing.lg }]}>Phone (optional)</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+961 XX XXX XXX" placeholderTextColor={Colors.gray[400]} keyboardType="phone-pad" />

          {/* Password */}
          <Text style={[styles.label, { marginTop: Spacing.lg }]}>Password * (min 8 chars)</Text>
          <View style={styles.passwordBox}>
            <TextInput style={styles.passwordInput} value={password} onChangeText={setPassword} placeholder="Create a password" placeholderTextColor={Colors.gray[400]} secureTextEntry={!showPassword} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.gray[400]} />
            </TouchableOpacity>
          </View>

          {/* Register button */}
          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Link to login */}
          <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.linkRow}>
            <Text style={styles.linkText}>Already have an account? </Text>
            <Text style={styles.linkBold}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand[50] },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xxxl },
  logoBox: {
    width: 72, height: 72, borderRadius: BorderRadius.xl, backgroundColor: Colors.brand[600],
    justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: Spacing.lg,
    shadowColor: Colors.brand[900], shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '700', textAlign: 'center', color: Colors.gray[900] },
  subtitle: { fontSize: FontSize.sm, color: Colors.gray[500], textAlign: 'center', marginBottom: Spacing.xxl },
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.xl,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  input: {
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white,
    fontSize: FontSize.md, color: Colors.gray[900],
  },
  selectInput: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white,
  },
  inputText: { fontSize: FontSize.md, color: Colors.gray[900], flex: 1 },
  placeholder: { fontSize: FontSize.md, color: Colors.gray[400], flex: 1 },
  nameRow: { flexDirection: 'row', gap: Spacing.md },
  picker: { marginTop: Spacing.xs, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: BorderRadius.md, overflow: 'hidden' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white },
  pickerItemActive: { backgroundColor: Colors.brand[50] },
  pickerText: { fontSize: FontSize.md, color: Colors.gray[700], flex: 1 },
  passwordBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md, backgroundColor: Colors.white },
  passwordInput: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.gray[900] },
  eyeBtn: { paddingHorizontal: Spacing.md },
  button: {
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, marginTop: Spacing.xl,
    shadowColor: Colors.brand[900], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  buttonText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.white },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  linkText: { fontSize: FontSize.sm, color: Colors.gray[500] },
  linkBold: { fontSize: FontSize.sm, color: Colors.brand[600], fontWeight: '600' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  loadingText: { fontSize: FontSize.sm, color: Colors.gray[500] },
  errorText: { fontSize: FontSize.sm, color: Colors.red[500], marginBottom: Spacing.xs },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  retryText: { fontSize: FontSize.sm, color: Colors.brand[600], fontWeight: '600' },
});
