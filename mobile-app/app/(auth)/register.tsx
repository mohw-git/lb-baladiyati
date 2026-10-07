import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/auth/store';
import { authApi, municipalitiesApi } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { getErrorPresentation, isNetworkError } from '../../lib/api/errors';
import { API_URL } from '../../constants/config';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { useTranslate, useIsRtl } from '../../lib/i18n';
import { AuthScreenShell, GovButton } from '../../components/ui';
import { flexRow } from '../../lib/ui/rtl';

interface Municipality { id: string; name: string; code: string; }

export default function RegisterScreen() {
  const router = useRouter();
  const t = useTranslate();
  const rtl = useIsRtl();
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
    municipalitiesApi
      .list()
      .then((data: unknown) => {
        let list: Municipality[] = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          Array.isArray((data as { data: Municipality[] }).data)
        ) {
          list = (data as { data: Municipality[] }).data;
        }
        setMunicipalities(list);
        if (list.length === 1) setSelectedMuni(list[0]);
        if (list.length === 0) setMuniError(t('auth.register.noMunis'));
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 429) {
          setMuniError(t('auth.register.muniRateLimit'));
          return;
        }
        if (__DEV__) {
          const pres = getErrorPresentation(err, t);
          const status =
            err instanceof ApiError ? `HTTP ${err.status}` : isNetworkError(err) ? 'network' : 'error';
          console.warn('[register] municipalities failed', `${API_URL}/municipalities`, status);
          setMuniError(
            `${t('auth.register.muniError')} [DEV] GET ${API_URL}/municipalities → ${status}: ${pres.message}`,
          );
        } else {
          setMuniError(t('auth.register.muniError'));
        }
      })
      .finally(() => setLoadingMunis(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount; locale change uses manual retry
  }, []);

  useEffect(() => {
    fetchMunicipalities();
  }, [fetchMunicipalities]);

  const handleRegister = async () => {
    if (!selectedMuni || !firstName || !lastName || !email || !password) {
      Alert.alert(t('common.error'), t('auth.fillAll'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('common.error'), t('auth.register.passwordHint'));
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
        Alert.alert(t('auth.register.failed'), err.details.map((d: any) => `• ${d.message}`).join('\n'));
      } else {
        Alert.alert(
          t('auth.register.failed'),
          err instanceof Error ? err.message : t('auth.serverError'),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreenShell headerSubtitle={t('auth.register.subtitle')}>
      <Text style={styles.label}>{t('auth.register.municipality')} *</Text>
      {loadingMunis ? (
        <View style={[styles.loadingRow, flexRow(rtl)]}>
          <ActivityIndicator size="small" color={Colors.brand[600]} />
          <Text style={styles.loadingText}>{t('auth.register.loadingMunis')}</Text>
        </View>
      ) : muniError ? (
        <View>
          <Text style={styles.errorText}>{muniError}</Text>
          <TouchableOpacity onPress={fetchMunicipalities} style={[styles.retryBtn, flexRow(rtl)]}>
            <Ionicons name="refresh" size={16} color={Colors.brand[600]} />
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity style={[styles.selectInput, flexRow(rtl)]} onPress={() => setShowMuniPicker(!showMuniPicker)}>
            <Text style={selectedMuni ? styles.inputText : styles.placeholder} numberOfLines={1}>
              {selectedMuni ? `${selectedMuni.name} (${selectedMuni.code})` : t('auth.register.selectMuni')}
            </Text>
            <Ionicons name={showMuniPicker ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray[400]} />
          </TouchableOpacity>
          {showMuniPicker && (
            <View style={styles.picker}>
              {municipalities.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.pickerItem, flexRow(rtl), selectedMuni?.id === m.id && styles.pickerItemActive]}
                  onPress={() => { setSelectedMuni(m); setShowMuniPicker(false); }}
                >
                  <Text style={[styles.pickerText, selectedMuni?.id === m.id && styles.pickerTextActive]}>
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

      <View style={[styles.nameRow, flexRow(rtl)]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { marginTop: Spacing.lg }]}>{t('auth.register.firstName')} *</Text>
          <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholderTextColor={Colors.gray[400]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { marginTop: Spacing.lg }]}>{t('auth.register.lastName')} *</Text>
          <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholderTextColor={Colors.gray[400]} />
        </View>
      </View>

      <Text style={[styles.label, { marginTop: Spacing.lg }]}>{t('auth.email')} *</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholderTextColor={Colors.gray[400]}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={[styles.label, { marginTop: Spacing.lg }]}>{t('auth.register.phone')}</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholderTextColor={Colors.gray[400]}
        keyboardType="phone-pad"
      />

      <Text style={[styles.label, { marginTop: Spacing.lg }]}>{t('auth.register.passwordHint')} *</Text>
      <View style={[styles.passwordBox, flexRow(rtl)]}>
        <TextInput
          style={styles.passwordInput}
          value={password}
          onChangeText={setPassword}
          placeholderTextColor={Colors.gray[400]}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
          <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.gray[400]} />
        </TouchableOpacity>
      </View>

      <GovButton
        label={t('auth.register.submit')}
        onPress={handleRegister}
        disabled={loading}
        loading={loading}
        style={{ marginTop: Spacing.xl }}
      />

      <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={[styles.linkRow, flexRow(rtl)]}>
        <Text style={styles.linkText}>{t('auth.register.hasAccount')} </Text>
        <Text style={styles.linkBold}>{t('auth.signIn')}</Text>
      </TouchableOpacity>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  input: {
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white,
    fontSize: FontSize.md, color: Colors.gray[900],
  },
  selectInput: {
    alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white,
  },
  inputText: { fontSize: FontSize.md, color: Colors.gray[900], flex: 1 },
  placeholder: { fontSize: FontSize.md, color: Colors.gray[400], flex: 1 },
  nameRow: { gap: Spacing.md },
  picker: { marginTop: Spacing.xs, borderWidth: 1, borderColor: Colors.gray[200], borderRadius: BorderRadius.md, overflow: 'hidden' },
  pickerItem: { alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white },
  pickerItemActive: { backgroundColor: Colors.brand[50] },
  pickerText: { fontSize: FontSize.md, color: Colors.gray[700], flex: 1 },
  pickerTextActive: { color: Colors.brand[700], fontWeight: '600' },
  passwordBox: { alignItems: 'center', borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md, backgroundColor: Colors.white },
  passwordInput: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.gray[900] },
  eyeBtn: { paddingHorizontal: Spacing.md },
  linkRow: { justifyContent: 'center', marginTop: Spacing.lg },
  linkText: { fontSize: FontSize.sm, color: Colors.gray[500] },
  linkBold: { fontSize: FontSize.sm, color: Colors.brand[600], fontWeight: '600' },
  loadingRow: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  loadingText: { fontSize: FontSize.sm, color: Colors.gray[500] },
  errorText: { fontSize: FontSize.sm, color: Colors.red[500], marginBottom: Spacing.xs },
  retryBtn: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm },
  retryText: { fontSize: FontSize.sm, color: Colors.brand[600], fontWeight: '600' },
});
