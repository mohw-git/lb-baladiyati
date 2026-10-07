import { useEffect, type ReactNode } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../lib/auth/store';
import { Colors } from '../constants/theme';

type AuthGateProps = {
  children: ReactNode;
  /** When true, staff with mandatory 2FA enrollment may access (e.g. enroll-2fa screen). */
  allowPendingTwoFactor?: boolean;
};

/**
 * Redirects unauthenticated users to login. Use on stack screens outside (tabs).
 */
export function AuthGate({ children, allowPendingTwoFactor = false }: AuthGateProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    const mustEnroll =
      (user as { mustEnrollTwoFactor?: boolean }).mustEnrollTwoFactor &&
      !(user as { twoFactorEnabled?: boolean }).twoFactorEnabled;
    if (mustEnroll && !allowPendingTwoFactor) {
      router.replace('/enroll-2fa');
    }
  }, [user, isLoading, allowPendingTwoFactor, router]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.brand[600]} />
      </View>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
});
