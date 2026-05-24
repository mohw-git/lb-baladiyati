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

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const user = useAuthStore((s) => s.user);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [twoFa, setTwoFa] = useState<{ challengeToken: string; code: string } | null>(null);

  useEffect(() => {
    if (user) router.replace('/(tabs)');
  }, [user]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      const res: any = await authApi.login({ email, password });
      if (res?.twoFactorRequired) {
        setTwoFa({ challengeToken: res.challengeToken, code: '' });
      } else {
        await setAuth(res.user, res.accessToken, res.refreshToken);
        router.replace('/(tabs)');
      }
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) {
        Alert.alert('Login Failed', err.details.map((d: any) => `• ${d.message}`).join('\n'));
      } else {
        Alert.alert('Login Failed', err instanceof Error ? err.message : 'Could not connect to server');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFa = async () => {
    if (!twoFa || twoFa.code.length !== 6) return;
    setLoading(true);
    try {
      const res = await (authApi as any).twoFactorLogin({
        challengeToken: twoFa.challengeToken,
        code: twoFa.code,
      });
      await setAuth(res.user, res.accessToken, res.refreshToken);
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert(
        'Invalid Code',
        err instanceof Error ? err.message : 'Verification failed',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoBox}>
          <Ionicons name="business" size={40} color={Colors.white} />
        </View>
        <Text style={styles.title}>Baladi</Text>
        <Text style={styles.subtitle}>Municipal Issue Reporting</Text>

        {twoFa ? (
          <View style={styles.card}>
            <View style={{ alignItems: 'center', marginBottom: Spacing.lg }}>
              <Ionicons name="shield-checkmark" size={36} color={Colors.brand[600]} />
              <Text style={[styles.label, { marginTop: Spacing.sm, fontSize: FontSize.md }]}>
                Enter the 6-digit code from your authenticator app
              </Text>
            </View>
            <TextInput
              style={[styles.input, { textAlign: 'center', fontSize: 28, letterSpacing: 4 }]}
              value={twoFa.code}
              onChangeText={(t) =>
                setTwoFa({ ...twoFa, code: t.replace(/[^0-9]/g, '').slice(0, 6) })
              }
              placeholder="123456"
              placeholderTextColor={Colors.gray[400]}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handleTwoFa}
              disabled={loading || twoFa.code.length !== 6}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.buttonText}>Verify & Sign In</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTwoFa(null)} style={{ marginTop: Spacing.md }}>
              <Text style={{ textAlign: 'center', color: Colors.gray[500] }}>Back to login</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <View style={styles.card}>
          {/* Email */}
          <Text style={styles.label}>Email</Text>
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

          {/* Password */}
          <Text style={[styles.label, { marginTop: Spacing.lg }]}>Password</Text>
          <View style={styles.passwordBox}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor={Colors.gray[400]}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.gray[400]} />
            </TouchableOpacity>
          </View>

          {/* Login button */}
          <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color={Colors.white} style={{ marginRight: Spacing.sm }} />
                <Text style={styles.buttonText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        )}

        {/* Sign Up link */}
        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.signUpRow}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <Text style={styles.signUpBold}>Sign Up</Text>
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
  card: {
    backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.xl,
    shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gray[700], marginBottom: Spacing.xs },
  input: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, backgroundColor: Colors.white,
    fontSize: FontSize.md, color: Colors.gray[900],
  },
  passwordBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.gray[300], borderRadius: BorderRadius.md, backgroundColor: Colors.white },
  passwordInput: { flex: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.md, color: Colors.gray[900] },
  eyeBtn: { paddingHorizontal: Spacing.md },
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.brand[600], borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2, marginTop: Spacing.xl,
    shadowColor: Colors.brand[900], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  buttonText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.white },
  signUpRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  signUpText: { fontSize: FontSize.sm, color: Colors.gray[500] },
  signUpBold: { fontSize: FontSize.sm, color: Colors.brand[600], fontWeight: '600' },
  footer: { fontSize: FontSize.xs, color: Colors.gray[400], textAlign: 'center', marginTop: Spacing.xxl },
});
