import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { colors, radius } from '@/theme';

// Full AgriAqua 360 logo (emblem + wordmark) on a white card, with the translated tagline.
export function BrandLockup({ dark, size = 'md' }: { dark?: boolean; size?: 'md' | 'lg' }) {
  const { t } = useTranslation();
  const w = size === 'lg' ? 220 : 150;
  return (
    <View style={styles.center}>
      <View style={[styles.card, { padding: size === 'lg' ? 18 : 10 }]}>
        <Image source={require('../../assets/images/logo-full.png')} style={{ width: w, height: w }} contentFit="contain" accessibilityLabel="AgriAqua 360" />
      </View>
      <AppText variant="labelMd" color={dark ? colors.mint : colors.textMuted} style={{ letterSpacing: size === 'lg' ? 5 : 2 }}>
        {t('brand.tagline').toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 10 },
  card: { backgroundColor: colors.white, borderRadius: radius.xl },
});
