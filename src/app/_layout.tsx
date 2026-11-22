import '@/locales';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from '@/locales';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {});
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  const [hydrated, setHydrated] = useState(usePreferences.persist.hasHydrated());
  const init = useSession((s) => s.init);

  useEffect(() => init(), [init]);
  useEffect(() => {
    const apply = () => {
      const l = usePreferences.getState().language;
      if (l && i18n.language !== l) i18n.changeLanguage(l);
      setHydrated(true);
    };
    if (usePreferences.persist.hasHydrated()) apply();
    return usePreferences.persist.onFinishHydration(apply);
  }, []);

  const ready = (fontsLoaded || !!fontError) && hydrated;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
