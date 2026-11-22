import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { colors, fonts, radius } from '@/theme';

export function BrandLockup({ dark, size = 'md' }: { dark?: boolean; size?: 'md' | 'lg' }) {
  const { t } = useTranslation();
  const big = size === 'lg';
  return (
    <View style={styles.center} accessible accessibilityLabel="AgriAqua 360">
      {!dark && (
        <View style={styles.tile}>
          <Image source={require('../../assets/images/logo-mark.png')} style={{ width: 64, height: 64 }} contentFit="contain" />
        </View>
      )}
      <View style={styles.row}>
        <AppText style={[styles.word, big && styles.big]} color={dark ? colors.white : colors.text}>Agri</AppText>
        <AppText style={[styles.word, big && styles.big]} color={dark ? colors.mint : colors.primary}>Aqua</AppText>
        <View style={[styles.badge, { backgroundColor: dark ? 'rgba(0,0,0,0.3)' : colors.primary }]}>
          <AppText style={[styles.badgeText, big && { fontSize: 24 }]} color={dark ? colors.mint : colors.white}>360</AppText>
        </View>
      </View>
      <AppText variant="labelMd" color={dark ? colors.mint : colors.textMuted} style={{ letterSpacing: big ? 5 : 2 }}>
        {t('brand.tagline').toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 6 },
  tile: { width: 96, height: 96, borderRadius: radius.xl, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  word: { fontFamily: fonts.headingBold, fontSize: 26, lineHeight: 34 },
  big: { fontFamily: fonts.headingXBold, fontSize: 44, lineHeight: 54 },
  badge: { marginLeft: 8, paddingHorizontal: 10, paddingVertical: 2, borderRadius: radius.md },
  badgeText: { fontFamily: fonts.headingBold, fontSize: 16, lineHeight: 30 },
});
