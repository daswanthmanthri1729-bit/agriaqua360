// 01 · Splash Screen — Stitch: 01_splash_loading_screen_1
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, BrandLockup, Chip, LanguagePills } from '@/components';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { nextRoute } from '@/features/auth/routing';
import { colors, radius } from '@/theme';

const MIN_SPLASH_MS = 1800;

export default function Splash() {
  const { t } = useTranslation();
  const ready = useSession((s) => s.ready);
  const progress = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    progress.value = withTiming(1, { duration: MIN_SPLASH_MS, easing: Easing.out(Easing.cubic) });
    pulse.value = withRepeat(withTiming(1.08, { duration: 1200 }), -1, true);
  }, [progress, pulse]);

  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      const { session, profile } = useSession.getState();
      router.replace(nextRoute({ prefs: usePreferences.getState(), session, profile }));
    }, MIN_SPLASH_MS);
    return () => clearTimeout(id);
  }, [ready]);

  const bar = useAnimatedStyle(() => ({ width: `${Math.max(4, progress.value * 100)}%` }));
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.bg}>
      <StatusBar style="light" />
      <LinearGradient colors={[colors.splashTop, '#0A4A2E', colors.splashBottom]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.top}>
          <Chip label={t('brand.tagline')} tone="dark" icon="eco" />
          <LanguagePills dark />
        </View>
        <Animated.View entering={FadeIn.duration(600)} style={styles.center}>
          <Animated.View style={[styles.ring, ring]}>
            <View style={styles.disc}>
              <Image source={require('../../assets/images/logo-mark.png')} style={{ width: 150, height: 150 }} contentFit="contain" accessibilityIgnoresInvertColors />
            </View>
          </Animated.View>
          <BrandLockup dark size="lg" />
          <AppText variant="bodyLg" color="rgba(255,255,255,0.9)" align="center" style={{ maxWidth: 320 }}>{t('brand.slogan')}</AppText>
          <View style={styles.chips}>
            <Chip label={t('splash.chipSoil')} tone="dark" icon="grass" />
            <Chip label={t('splash.chipAqua')} tone="dark" icon="water-drop" />
            <Chip label={t('splash.chipAI')} tone="dark" icon="auto-awesome" />
          </View>
        </Animated.View>
        <View style={styles.bottom} accessible accessibilityRole="progressbar" accessibilityLabel={t('splash.loading')}>
          <View style={styles.track}><Animated.View style={[styles.fill, bar]} /></View>
          <AppText variant="bodyMd" color="rgba(136,215,168,0.85)" align="center">{t('brand.footer')}</AppText>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: colors.splashTop },
  safe: { flex: 1, paddingHorizontal: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, gap: 8, flexWrap: 'wrap' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  ring: { width: 240, height: 240, borderRadius: 120, borderWidth: 1, borderColor: 'rgba(136,215,168,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  disc: { width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  bottom: { gap: 16, paddingBottom: 16 },
  track: { height: 12, borderRadius: radius.full, backgroundColor: 'rgba(0,0,0,0.3)', overflow: 'hidden', padding: 3 },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.mint },
});
