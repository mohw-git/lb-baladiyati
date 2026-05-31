import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  Pressable,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../lib/auth/store';
import { authApi } from '../lib/api/endpoints';
import { ApiError } from '../lib/api/client';
import { GovButton, GovCard, LoadingState } from '../components/ui';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { useTranslate, useIsRtl } from '../lib/i18n';
import { textAlignStart } from '../lib/ui/rtl';
import { AuthGate } from '../components/auth-gate';

export default function SecurityScreen() {
  return (
    <AuthGate allowPendingTwoFactor>
      <SecurityContent />
    </AuthGate>
  );
}

function SecurityContent() {
  const router = useRouter();
  const t = useTranslate();
  const rtl = useIsRtl();
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  const [emailPassword, setEmailPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpSetup, setTotpSetup] = useState<{
    qrCodeDataUrl: string;
    secret: string;
  } | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disableOtpSent, setDisableOtpSent] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => authApi.getProfile(),
  });

  const refreshProfile = async () => {
    const fresh = await authApi.getProfile();
    setUser(fresh);
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return fresh;
  };

  const twoFactorEnabled = !!profile?.twoFactorEnabled;
  const twoFactorMethod = profile?.twoFactorMethod as 'TOTP' | 'EMAIL' | undefined;
  const emailVerified = profile?.emailVerified !== false;

  const enableEmailMutation = useMutation({
    mutationFn: () => authApi.enableEmailTwoFactor(emailPassword),
    onSuccess: async () => {
      setEmailPassword('');
      await refreshProfile();
      Alert.alert(t('common.success'), t('security.setupSuccess'));
    },
    onError: (err: unknown) => {
      Alert.alert(
        t('common.error'),
        err instanceof ApiError ? err.message : t('security.enableFailed'),
      );
    },
  });

  const setupTotpMutation = useMutation({
    mutationFn: () => authApi.setupTwoFactor(),
    onSuccess: (data) => {
      setTotpSetup({ qrCodeDataUrl: data.qrCodeDataUrl, secret: data.secret });
      setTotpCode('');
    },
    onError: (err: unknown) => {
      Alert.alert(
        t('common.error'),
        err instanceof ApiError ? err.message : t('security.enableFailed'),
      );
    },
  });

  const verifyTotpMutation = useMutation({
    mutationFn: () => authApi.verifyTwoFactor(totpCode.trim()),
    onSuccess: async () => {
      setTotpSetup(null);
      setTotpCode('');
      await refreshProfile();
      Alert.alert(t('common.success'), t('security.setupSuccess'));
    },
    onError: (err: unknown) => {
      Alert.alert(
        t('common.error'),
        err instanceof ApiError ? err.message : t('security.enableFailed'),
      );
    },
  });

  const disableTotpMutation = useMutation({
    mutationFn: () =>
      authApi.disableTwoFactor({
        password: disablePassword,
        code: disableCode.trim(),
      }),
    onSuccess: async () => {
      setDisablePassword('');
      setDisableCode('');
      await refreshProfile();
      Alert.alert(t('common.success'), t('security.disableSuccess'));
    },
    onError: (err: unknown) => {
      Alert.alert(
        t('common.error'),
        err instanceof ApiError ? err.message : t('security.enableFailed'),
      );
    },
  });

  const requestDisableEmailMutation = useMutation({
    mutationFn: () => authApi.requestDisableEmailTwoFactor(disablePassword),
    onSuccess: () => {
      setDisableOtpSent(true);
      Alert.alert(t('common.success'), t('auth.2fa.codeResent'));
    },
    onError: (err: unknown) => {
      Alert.alert(
        t('common.error'),
        err instanceof ApiError ? err.message : t('security.enableFailed'),
      );
    },
  });

  const confirmDisableEmailMutation = useMutation({
    mutationFn: () =>
      authApi.confirmDisableEmailTwoFactor({
        password: disablePassword,
        code: disableCode.trim(),
      }),
    onSuccess: async () => {
      setDisablePassword('');
      setDisableCode('');
      setDisableOtpSent(false);
      await refreshProfile();
      Alert.alert(t('common.success'), t('security.disableSuccess'));
    },
    onError: (err: unknown) => {
      Alert.alert(
        t('common.error'),
        err instanceof ApiError ? err.message : t('security.enableFailed'),
      );
    },
  });

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: t('security.title'), headerBackTitle: t('common.back') }} />
        <LoadingState />
      </>
    );
  }

  const statusText = twoFactorEnabled
    ? twoFactorMethod === 'EMAIL'
      ? t('security.emailEnabled')
      : t('security.totpEnabled')
    : t('security.notEnabled');

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: t('security.title'), headerBackTitle: t('common.back') }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <GovCard>
          <Text style={[styles.status, textAlignStart(rtl)]}>{statusText}</Text>
          {twoFactorEnabled && (
            <Text style={[styles.method, textAlignStart(rtl)]}>
              {twoFactorMethod === 'EMAIL' ? t('profile.2fa.methodEmail') : t('profile.2fa.methodTotp')}
            </Text>
          )}
        </GovCard>

        {!twoFactorEnabled && (
          <>
            <GovCard>
              <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('security.email2fa')}</Text>
              <Text style={[styles.hint, textAlignStart(rtl)]}>{t('enroll2fa.emailHint')}</Text>
              {!emailVerified && (
                <Text style={[styles.warn, textAlignStart(rtl)]}>{t('enroll2fa.emailNotVerified')}</Text>
              )}
              <Text style={[styles.label, textAlignStart(rtl)]}>{t('security.password')}</Text>
              <TextInput
                style={[styles.input, textAlignStart(rtl)]}
                value={emailPassword}
                onChangeText={setEmailPassword}
                secureTextEntry
                autoCapitalize="none"
                editable={emailVerified && !enableEmailMutation.isPending}
              />
              <GovButton
                label={t('security.enableEmail')}
                onPress={() => enableEmailMutation.mutate()}
                loading={enableEmailMutation.isPending}
                disabled={!emailVerified || !emailPassword}
              />
            </GovCard>

            <GovCard>
              <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('security.totp2fa')}</Text>
              {!totpSetup ? (
                <GovButton
                  label={t('security.setupTotp')}
                  onPress={() => setupTotpMutation.mutate()}
                  loading={setupTotpMutation.isPending}
                  variant="outline"
                />
              ) : (
                <>
                  <Text style={[styles.hint, textAlignStart(rtl)]}>{t('security.scanQr')}</Text>
                  <Image
                    source={{ uri: totpSetup.qrCodeDataUrl }}
                    style={styles.qr}
                    resizeMode="contain"
                  />
                  <Text style={[styles.label, textAlignStart(rtl)]}>{t('security.secretLabel')}</Text>
                  <Text style={[styles.secret, textAlignStart(rtl)]} selectable>
                    {totpSetup.secret}
                  </Text>
                  <Text style={[styles.label, textAlignStart(rtl)]}>{t('security.code')}</Text>
                  <TextInput
                    style={[styles.input, textAlignStart(rtl)]}
                    value={totpCode}
                    onChangeText={setTotpCode}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <GovButton
                    label={t('security.verifyTotp')}
                    onPress={() => verifyTotpMutation.mutate()}
                    loading={verifyTotpMutation.isPending}
                    disabled={totpCode.trim().length < 6}
                  />
                  <Pressable onPress={() => setTotpSetup(null)} style={styles.cancelLink}>
                    <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                  </Pressable>
                </>
              )}
            </GovCard>
          </>
        )}

        {twoFactorEnabled && (
          <GovCard>
            <Text style={[styles.sectionTitle, textAlignStart(rtl)]}>{t('security.disableTitle')}</Text>
            {twoFactorMethod === 'EMAIL' && (
              <Text style={[styles.hint, textAlignStart(rtl)]}>{t('security.disableEmailHint')}</Text>
            )}
            <Text style={[styles.label, textAlignStart(rtl)]}>{t('security.password')}</Text>
            <TextInput
              style={[styles.input, textAlignStart(rtl)]}
              value={disablePassword}
              onChangeText={setDisablePassword}
              secureTextEntry
              autoCapitalize="none"
            />
            {(twoFactorMethod === 'EMAIL' ? disableOtpSent : true) && (
              <>
                <Text style={[styles.label, textAlignStart(rtl)]}>{t('security.code')}</Text>
                <TextInput
                  style={[styles.input, textAlignStart(rtl)]}
                  value={disableCode}
                  onChangeText={setDisableCode}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </>
            )}
            {twoFactorMethod === 'EMAIL' && !disableOtpSent ? (
              <GovButton
                label={t('security.sendDisableCode')}
                onPress={() => requestDisableEmailMutation.mutate()}
                loading={requestDisableEmailMutation.isPending}
                disabled={!disablePassword}
                variant="outline"
              />
            ) : (
              <GovButton
                label={t('security.disableConfirm')}
                onPress={() =>
                  twoFactorMethod === 'EMAIL'
                    ? confirmDisableEmailMutation.mutate()
                    : disableTotpMutation.mutate()
                }
                loading={
                  confirmDisableEmailMutation.isPending || disableTotpMutation.isPending
                }
                disabled={!disablePassword || disableCode.trim().length < 6}
                variant="danger"
              />
            )}
          </GovCard>
        )}

        {profile?.mustEnrollTwoFactor && !twoFactorEnabled && (
          <GovButton
            label={t('enroll2fa.title')}
            onPress={() => router.push('/enroll-2fa')}
            variant="outline"
          />
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  status: { fontSize: FontSize.md, fontWeight: '600', color: Colors.gray[900] },
  method: { fontSize: FontSize.sm, color: Colors.gray[600], marginTop: Spacing.xs },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gray[900], marginBottom: Spacing.sm },
  hint: { fontSize: FontSize.xs, color: Colors.gray[600], marginBottom: Spacing.md },
  warn: { fontSize: FontSize.xs, color: Colors.orange[700], marginBottom: Spacing.md },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    color: Colors.gray[900],
  },
  qr: { width: 220, height: 220, alignSelf: 'center', marginVertical: Spacing.md },
  secret: {
    fontSize: FontSize.sm,
    fontFamily: 'monospace',
    color: Colors.gray[800],
    marginBottom: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: Colors.gray[100],
    borderRadius: BorderRadius.sm,
  },
  cancelLink: { alignItems: 'center', marginTop: Spacing.sm },
  cancelText: { color: Colors.gray[500], fontSize: FontSize.sm },
});
