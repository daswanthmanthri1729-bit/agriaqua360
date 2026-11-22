import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon, IconName } from '@/components';
import { useSession } from '@/store/session';
import { colors, fonts } from '@/theme';

// Stitch tab bar: pill behind the active icon, label below.
const icon = (name: IconName) => ({ color, focused }: { color: unknown; focused: boolean }) => (
  <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.surfaceContainer : 'transparent' }}>
    <Icon name={name} color={color as string} size={22} />
  </View>
);

export default function TabsLayout() {
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  const insets = useSafeAreaInsets();
  if (!session) return <Redirect href="/auth/login" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDeep,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarItemStyle: { paddingVertical: 4 },
        tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 12 },
        tabBarStyle: { height: 76 + insets.bottom, paddingTop: 4, paddingBottom: insets.bottom + 4, backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('nav.home'), tabBarIcon: icon('home') }} />
      <Tabs.Screen name="agriculture" options={{ title: t('nav.agriculture'), tabBarIcon: icon('agriculture') }} />
    </Tabs>
  );
}
