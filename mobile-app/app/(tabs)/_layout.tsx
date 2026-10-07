import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../lib/auth/store';
import { useIsFieldWorker, useCitizenMobileExperience } from '../../lib/hooks/usePermission';
import { Colors } from '../../constants/theme';
import { View, ActivityIndicator, Text } from 'react-native';
import { useTranslate, useIsRtl } from '../../lib/i18n';
import { TAB_HORIZONTAL_PADDING } from '../../lib/ui/tab-layout-metrics';
import {
  getTabBarHeight,
  getTabBarPaddingBottom,
  TAB_BAR_CORE_HEIGHT,
} from '../../lib/ui/tab-layout-metrics';

export default function TabLayout() {
  const { user, isLoading } = useAuthStore();
  const isFieldWorker = useIsFieldWorker();
  const citizenMobile = useCitizenMobileExperience();
  const t = useTranslate();
  const rtl = useIsRtl();
  const insets = useSafeAreaInsets();
  const tabBarHeight = getTabBarHeight(insets.bottom);
  const tabBarPaddingBottom = getTabBarPaddingBottom(insets.bottom);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.brand[600]} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if ((user as any).mustEnrollTwoFactor && !(user as any).twoFactorEnabled) {
    return <Redirect href="/enroll-2fa" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.navy[900],
        tabBarInactiveTintColor: Colors.gray[400],
        tabBarStyle: {
          borderTopColor: Colors.gray[200],
          backgroundColor: Colors.white,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 6,
        },
        tabBarItemStyle: {
          height: TAB_BAR_CORE_HEIGHT - 12,
          justifyContent: 'center',
          paddingVertical: 0,
        },
        tabBarIconStyle: { marginTop: 0 },
        tabBarLabelStyle: {
          fontSize: 9,
          lineHeight: 12,
          fontWeight: '600',
          marginTop: 2,
          marginBottom: 0,
        },
        headerStyle: {
          backgroundColor: Colors.navy[900],
        },
        headerTintColor: Colors.white,
        headerTitle: ({ children }) => (
          <Text
            numberOfLines={1}
            style={{
              color: Colors.white,
              fontWeight: '700',
              fontSize: 17,
              flex: 1,
              textAlign: rtl ? 'right' : 'left',
            }}
          >
            {children}
          </Text>
        ),
        headerTitleContainerStyle: {
          paddingHorizontal: TAB_HORIZONTAL_PADDING,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="submit"
        options={{
          title: t('tabs.submit'),
          href: citizenMobile ? '/(tabs)/submit' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size + 4} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('tabs.tasks'),
          href: isFieldWorker ? '/(tabs)/tasks' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard" size={size} color={color} />,
        }}
      />
      {/* Inbox / transfers stay on web dashboard — not exposed on mobile */}
      <Tabs.Screen
        name="inbox"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="complaints"
        options={{
          title: isFieldWorker ? t('tabs.tasks') : t('tabs.complaints'),
          href: citizenMobile ? '/(tabs)/complaints' : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: t('tabs.news'),
          href: citizenMobile ? '/(tabs)/news' : null,
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
