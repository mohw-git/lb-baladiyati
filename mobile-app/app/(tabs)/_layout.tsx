import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../lib/auth/store';
import { useHasAnyPermission, useUserRole, PERMISSIONS } from '../../lib/hooks/usePermission';
import { Colors } from '../../constants/theme';
import { View, ActivityIndicator } from 'react-native';
import { useTranslate } from '../../lib/i18n';

export default function TabLayout() {
  const { user, isLoading } = useAuthStore();
  const userRole = useUserRole();
  const t = useTranslate();
  // Must run on every render — never call hooks after conditional returns below.
  const canSeeInbox = useHasAnyPermission(
    PERMISSIONS.HELP_VIEW,
    PERMISSIONS.TRANSFER_VIEW,
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.brand[600]} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if ((user as any).mustEnrollTwoFactor && !(user as any).twoFactorEnabled) {
    return <Redirect href="/enroll-2fa" />;
  }

  const isWorkerOrAbove = userRole === 'worker' || userRole === 'supervisor' || userRole === 'admin';
  const isCitizen = userRole === 'citizen';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.brand[600],
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: {
          borderTopColor: Colors.gray[200],
          backgroundColor: Colors.white,
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: Colors.white },
        headerTintColor: Colors.gray[900],
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      {/* Show submit only for citizens */}
      <Tabs.Screen
        name="submit"
        options={{
          title: t('tabs.submit'),
          href: isCitizen ? '/(tabs)/submit' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size + 4} color={color} />,
        }}
      />
      {/* Show assigned tasks for workers */}
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('tabs.tasks'),
          href: isWorkerOrAbove ? '/(tabs)/tasks' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" size={size} color={color} />,
        }}
      />
      {/* Cross-department inbox: transfers (HOD/Admin) and help requests
          (workers can both raise and view). Hidden for pure citizens. */}
      <Tabs.Screen
        name="inbox"
        options={{
          title: t('tabs.inbox'),
          href: canSeeInbox ? '/(tabs)/inbox' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="git-pull-request" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: t('tabs.complaints'),
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: t('tabs.news'),
          tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
