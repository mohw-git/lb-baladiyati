import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/auth/store';
import { authApi } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { useTranslate } from '../../lib/i18n';

type TwoFactorMethod = 'TOTP' | 'EMAIL';

function routeAfterAuth(router: ReturnType<typeof useRouter>, user: any) {
  if (user?.mustEnrollTwoFactor && !user?.twoFactorEnabled) {
    router.replace('/enroll-2fa');
  } else {
    router.replace('/(tabs)');
  }
}

export default function LoginScreen() {
  const router = useRouter();
  const t = useTranslate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const [twoFa, setTwoFa] = useState<{
    challengeToken: string;
    code: string;
    method: TwoFactorMethod;
  } | null>(null);

  useEffect(() => {
    if (user) routeAfterAuth(router, user);
  }, [user]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.fillAll'));
      return;
    }
    setLoading(true);
    setUnverifiedEmail(null);
    try {
      const res: any = await authApi.login({ email, password });
      if (res?.twoFactorRequired) {
        const method: TwoFactorMethod = res.twoFactorMethod === 'EMAIL' ? 'EMAIL' : 'TOTP';
        setTwoFa({ challengeToken: res.challengeToken, code: '', method });
      } else {
        await setAuth(res.user, res.accessToken, res.refreshToken);
        routeAfterAuth(router, res.user);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        const echoed = (err.meta?.email as string | undefined) ?? email;
        setUnverifiedEmail(echoed);
      } else if (err instanceof ApiError && err.details?.length) {
        Alert.alert(t('auth.loginFailed'), err.details.map((d) => `• ${d.message}`).join('\n'));
      } else {
        Alert.alert(
          t('auth.loginFailed'),
          err instanceof Error ? err.message : t('auth.serverError'),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFa = async () => {
    if (!twoFa || twoFa.code.length !== 6) return;
    setLoading(true);
    try {
      const res =
        twoFa.method === 'EMAIL'
          ? await authApi.emailTwoFactorLogin({
              challengeToken: twoFa.challengeToken,
              code: twoFa.code,
            })
          : await authApi.twoFactorLogin({
              challengeToken: twoFa.challengeToken,
              code: twoFa.code,
            });
      await setAuth(res.user, res.accessToken, res.refreshToken);
      routeAfterAuth(router, res.user);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t('auth.2fa.invalid');
      Alert.alert(t('auth.2fa.invalidTitle'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!twoFa || twoFa.method !== 'EMAIL') return;
    setResendingCode(true);
    try {
      await authApi.resendEmailTwoFactorCode(twoFa.challengeToken);
      Alert.alert(t('common.success'), t('auth.2fa.codeResent'));
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('auth.serverError'),
      );
    } finally {
      setResendingCode(false);
    }
  };

  const handleResendVerification = async () => {
    const target = unverifiedEmail ?? email;
    if (!target) return;
    setLoading(true);
    try {
      await authApi.resendVerification(target);
      Alert.alert(t('common.success'), t('auth.unverified.resendSuccess'));
    } catch (err) {
      Alert.alert(
        t('common.error'),
        err instanceof Error ? err.message : t('auth.serverError'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.logoBox}>
          <Ionicons name="business" size={40} color={Colors.white} />
        </View>
        <Text style={styles.title}>Baladi</Text>
        <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

        {unverifiedEmail && !twoFa && (
          <View style={styles.banner}>
            <Ionicons name="mail-unread-outline" size={22} color={Colors.orange[700]} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <Text style={styles.bannerTitle}>{t('auth.unverified.title')}</Text>
              <Text style={styles.bannerText}>{t('auth.unverified.body')}</Text>
              <TouchableOpacity onPress={handleResendVerification} disabled={loading} style={{ marginTop: Spacing.sm }}>
                <Text style={styles.bannerLink}>{t('auth.unverified.resend')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {twoFa ? (
          <View style={styles.card}>
            <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
              <Ionicons name="shield-checkmark" size={36} color={Colors.brand[600]} />
              <Text style={[styles.label, { marginTop: Spacing.sm, fontSize: FontSize.md, textAlign: 'center' }]}>
                {twoFa.method === 'EMAIL' ? t('auth.2fa.emailSubtitle') : t('auth.2fa.totpSubtitle')}
              </Text>
            </View>
            <TextInput
              style={[styles.input, { textAlign: 'center', fontSize: 28, letterSpacing: 4 }]}
              value={twoFa.code}
              onChangeText={(v) =>
                setTwoFa({ ...twoFa, code: v.replace(/[^0-9]/g, '').slice(0, 6) })
              }
              placeholder="123456"
              placeholderTextColor={Colors.gray[400]}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            {twoFa.method === 'EMAIL' && (
              <TouchableOpacity
                onPress={handleResendCode}
                disabled={resendingCode}
                style={{ marginTop: Spacing.md }}
              >
                <Text style={styles.resendLink}>
                  {resendingCode ? t('auth.2fa.resending') : t('auth.2fa.resend')}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.button}
              onPress={handleTwoFa}
              disabled={loading || twoFa.code.length !== 6}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.buttonText}>{t('auth.2fa.verify')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setTwoFa(null);
                setUnverifiedEmail(null);
              }}
              style={{ marginTop: Spacing.md }}
            >
              <Text style={{ textAlign: 'center', color: Colors.gray[500] }}>{t('auth.2fa.back')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>{t('auth.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="admin@beirut.gov.lb"
              placeholderTextColor={Colors.gray[400]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={[styles.label, { marginTop: Spacing.lg }]}>{t('auth.password')}</Text>
            <View style={styles.passwordBox}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={Colors.gray[400]}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.gray[400]} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color={Colors.white} style={{ marginRight: Spacing.sm }} />
                  <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.signUpRow}>
          <Text style={styles.signUpText}>{t('auth.noAccount')} </Text>
          <Text style={styles.signUpBold}>{t('auth.signUp')}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Baladi v1.0.0</Text>
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
  banner: {
    flexDirection: 'row',
    backgroundColor: Colors.orange[50],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.orange[500],
  },
  bannerTitle: { fontWeight: '700', fontSize: FontSize.sm, color: Colors.gray[900] },
  bannerText: { fontSize: FontSize.xs, color: Colors.gray[600], marginTop: 2 },
  bannerLink: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[600] },
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
  resendLink: { textAlign: 'center', color: Colors.brand[600], fontWeight: '600', fontSize: FontSize.sm },
  passwordBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md, backgroundColor: Colors.white },
  passwordInput: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.gray[900] },
  eyeBtn: { paddingHorizontal: Spacing.md },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md, marginTop: Spacing.xl,
  },
  buttonText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  signUpRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  signUpText: { color: Colors.gray[500], fontSize: FontSize.sm },
  signUpBold: { color: Colors.brand[600], fontSize: FontSize.sm, fontWeight: '700' },
  footer: { textAlign: 'center', color: Colors.gray[400], fontSize: FontSize.xs, marginTop: Spacing.xxl },
});
