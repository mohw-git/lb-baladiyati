import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Spacing } from '../../constants/theme';
import { AuthPortalLayout } from './auth-portal-layout';
import { useTranslate } from '../../lib/i18n';

type AuthScreenShellProps = {
  children: ReactNode;
  showBackToWelcome?: boolean;
  headerSubtitle?: string;
};

export function AuthScreenShell({
  children,
  showBackToWelcome = true,
  headerSubtitle,
}: AuthScreenShellProps) {
  const t = useTranslate();

  return (
    <>
      <StatusBar style="light" />
      <AuthPortalLayout
        mode="form"
        brandTitle={t('welcome.brandName')}
        brandTagline={t('welcome.brandTagline')}
        formSubtitle={headerSubtitle ?? t('auth.subtitle')}
        showBack={showBackToWelcome}
        backLabel={t('welcome.back')}
      >
        <View style={styles.formCard}>{children}</View>
      </AuthPortalLayout>
    </>
  );
}

const styles = StyleSheet.create({
  formCard: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
});
