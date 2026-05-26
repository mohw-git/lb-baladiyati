import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Linking,
} from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/auth/store';
import { authApi } from '../../lib/api/endpoints';
import { ApiError } from '../../lib/api/client';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { WEB_FORGOT_PASSWORD_URL } from '../../constants/config';
import { useTranslate, useIsRtl } from '../../lib/i18n';
import { AuthScreenShell, ErrorBanner, GovButton } from '../../components/ui';
import { flexRow } from '../../lib/ui/rtl';

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
  const rootNavigationState = useRootNavigationState();
  const navigationReady = !!rootNavigationState?.key;
  const t = useTranslate();
  const rtl = useIsRtl();
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
    if (!navigationReady || !user) return;
    routeAfterAuth(router, user);
  }, [user, navigationReady, router]);

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
        if (navigationReady) routeAfterAuth(router, res.user);
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
      if (navigationReady) routeAfterAuth(router, res.user);
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

  const openForgotPassword = () => {
    Alert.alert(t('auth.forgotPassword'), t('auth.forgotPasswordHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.forgotPasswordOpen'),
        onPress: () => void Linking.openURL(WEB_FORGOT_PASSWORD_URL).catch(() => {}),
      },
    ]);
  };

  return (
    <AuthScreenShell headerSubtitle={t('auth.subtitle')}>
        {unverifiedEmail && !twoFa && (
          <ErrorBanner title={t('auth.unverified.title')} message={t('auth.unverified.body')}>
            <TouchableOpacity onPress={handleResendVerification} disabled={loading}>
              <Text style={styles.bannerLink}>{t('auth.unverified.resend')}</Text>
            </TouchableOpacity>
          </ErrorBanner>
        )}

        {twoFa ? (
          <View>
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
            <GovButton
              label={t('auth.2fa.verify')}
              onPress={handleTwoFa}
              disabled={loading || twoFa.code.length !== 6}
              loading={loading}
              style={{ marginTop: Spacing.xl }}
            />
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
          <View>
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

            <TouchableOpacity onPress={openForgotPassword} style={styles.forgotRow}>
              <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>

            <GovButton
              label={t('auth.signIn')}
              onPress={handleLogin}
              disabled={loading}
              loading={loading}
              icon="log-in-outline"
              style={{ marginTop: Spacing.lg }}
            />
          </View>
        )}

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={[styles.signUpRow, flexRow(rtl)]}>
          <Text style={styles.signUpText}>{t('auth.noAccount')} </Text>
          <Text style={styles.signUpBold}>{t('auth.signUp')}</Text>
        </TouchableOpacity>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  bannerLink: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.brand[600], marginTop: Spacing.sm },
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
  forgotRow: { alignSelf: 'flex-end', marginTop: Spacing.sm },
  forgotText: { fontSize: FontSize.sm, color: Colors.brand[600], fontWeight: '600' },
  signUpRow: { justifyContent: 'center', marginTop: Spacing.xl },
  signUpText: { color: Colors.gray[500], fontSize: FontSize.sm },
  signUpBold: { color: Colors.brand[600], fontSize: FontSize.sm, fontWeight: '700' },
});
