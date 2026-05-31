import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../lib/auth/store';
import { authApi } from '../lib/api/endpoints';
import { ApiError } from '../lib/api/client';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { useTranslate } from '../lib/i18n';
import { AuthGate } from '../components/auth-gate';

/**
 * Blocking screen for staff who must enrol in 2FA before using the app.
 * Supports email-based 2FA enrolment and in-app TOTP via Security screen.
 */
export default function EnrollTwoFactorScreen() {
  return (
    <AuthGate allowPendingTwoFactor>
      <EnrollTwoFactorContent />
    </AuthGate>
  );
}

function EnrollTwoFactorContent() {
  const router = useRouter();
  const t = useTranslate();
  const { user, setUser, logout } = useAuthStore();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const emailVerified = user?.emailVerified !== false;

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      await authApi.resendVerification(user.email);
      Alert.alert(t('common.success'), t('auth.unverified.resendSuccess'));
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof ApiError ? err.message : t('common.error'),
      );
    } finally {
      setResending(false);
    }
  };

  const handleEnableEmail = async () => {
    if (!password) {
      Alert.alert(t('common.error'), t('enroll2fa.passwordRequired'));
      return;
    }
    setLoading(true);
    try {
      await authApi.enableEmailTwoFactor(password);
      const fresh = await authApi.getProfile();
      setUser(fresh);
      Alert.alert(t('common.success'), t('enroll2fa.emailSuccess'), [
        { text: t('common.ok'), onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof ApiError ? err.message : t('enroll2fa.enableFailed'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace('/(auth)/welcome');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.iconBox}>
        <Ionicons name="shield-checkmark" size={40} color={Colors.brand[600]} />
      </View>
      <Text style={styles.title}>{t('enroll2fa.title')}</Text>
      <Text style={styles.body}>{t('enroll2fa.body')}</Text>

      {!emailVerified && (
        <View style={styles.verifyCard}>
          <Text style={styles.verifyTitle}>{t('auth.unverified.title')}</Text>
          <Text style={styles.verifyBody}>{t('auth.unverified.body')}</Text>
          <TouchableOpacity
            onPress={handleResendVerification}
            disabled={resending}
            style={styles.resendBtn}
          >
            <Text style={styles.resendText}>
              {resending ? t('auth.2fa.resending') : t('auth.unverified.resend')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('enroll2fa.emailTitle')}</Text>
        <Text style={styles.cardHint}>
          {emailVerified ? t('enroll2fa.emailHint') : t('enroll2fa.emailNotVerified')}
        </Text>
        <Text style={styles.label}>{t('enroll2fa.password')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={emailVerified && !loading}
        />
        <TouchableOpacity
          style={[styles.primaryBtn, (!emailVerified || loading) && styles.btnDisabled]}
          onPress={handleEnableEmail}
          disabled={!emailVerified || loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.primaryBtnText}>{t('enroll2fa.enableEmail')}</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.secondaryBtn}
        onPress={() => router.push('/security')}
      >
        <Ionicons name="phone-portrait-outline" size={20} color={Colors.brand[700]} />
        <Text style={styles.secondaryBtnText}>{t('security.setupTotp')}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
        <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.brand[50] },
  content: { padding: Spacing.xl, paddingTop: Spacing.xxxl },
  iconBox: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700', textAlign: 'center', color: Colors.gray[900] },
  body: { fontSize: FontSize.sm, color: Colors.gray[600], textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.xl },
  verifyCard: {
    backgroundColor: Colors.orange[50],
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.orange[500],
  },
  verifyTitle: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.orange[700] },
  verifyBody: { fontSize: FontSize.xs, color: Colors.orange[600], marginTop: Spacing.xs, marginBottom: Spacing.sm },
  resendBtn: { alignSelf: 'flex-start' },
  resendText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[700] },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900] },
  cardHint: { fontSize: FontSize.xs, color: Colors.gray[500], marginTop: Spacing.xs, marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
  },
  primaryBtn: {
    backgroundColor: Colors.brand[600],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.brand[200],
  },
  secondaryBtnText: { color: Colors.brand[700], fontWeight: '600', fontSize: FontSize.sm },
  noteCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.gray[100],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  noteText: { flex: 1, fontSize: FontSize.sm, color: Colors.gray[700] },
  signOutBtn: { marginTop: Spacing.xxl, alignItems: 'center' },
  signOutText: { color: Colors.red[600], fontWeight: '600', fontSize: FontSize.sm },
});
