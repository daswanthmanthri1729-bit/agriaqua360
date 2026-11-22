// 02 · Welcome / Introduction — Stitch: 02_welcome_screen_1
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Chip, Icon, IconName, LanguagePills, LogoMark, Screen } from '@/components';
import { colors, radius } from '@/theme';

const SECTORS: { key: string; icon: IconName; tag: string; sub: string; tint: string }[] = [
  { key: 'agriculture', icon: 'grass', tag: 'welcome.agriTag', sub: 'welcome.agriSub', tint: colors.surfaceContainer },
  { key: 'aquaculture', icon: 'waves', tag: 'welcome.aquaTag', sub: 'welcome.aquaSub', tint: '#DDF7EA' },
  { key: 'livestock', icon: 'pets', tag: 'welcome.liveTag', sub: 'welcome.liveSub', tint: colors.surfaceHigh },
];

export default function Welcome() {
  const { t } = useTranslation();
  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.logoRow}>
          <LogoMark size={40} />
          <AppText variant="headlineSm">AgriAqua 360</AppText>
        </View>
        <LanguagePills />
      </View>

      <View style={styles.hero}>
        <Image source={require('../../../assets/images/hero-farm.jpg')} style={StyleSheet.absoluteFill} contentFit="cover"
          accessibilityLabel={t('welcome.heroCaption')} />
        <View style={styles.heroBadge}>
          <View style={styles.dot} />
          <AppText variant="labelLg" color={colors.primaryDeep}>{t('welcome.badge')}</AppText>
        </View>
        <View style={styles.heroCaption}>
          <Icon name="auto-awesome" size={18} color={colors.mint} />
          <AppText variant="labelLg" color={colors.white} style={{ flex: 1 }}>{t('welcome.heroCaption')}</AppText>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <AppText variant="display" accessibilityRole="header">{t('welcome.title')}</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('welcome.subtitle')}</AppText>
      </View>

      {SECTORS.map((s) => (
        <Card key={s.key} style={styles.sector}>
          <View style={[styles.sectorIcon, { backgroundColor: s.tint }]}><Icon name={s.icon} size={28} color={colors.primaryDeep} /></View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.sectorTitle}>
              <AppText variant="headlineSm">{t(`sectors.${s.key}`)}</AppText>
              <Chip label={t(s.tag)} />
            </View>
            <AppText variant="bodyMd" color={colors.textMuted}>{t(s.sub)}</AppText>
          </View>
        </Card>
      ))}

      <View style={{ gap: 12, marginTop: 8 }}>
        <Button testID="get-started" label={t('welcome.getStarted')} icon="arrow-forward" onPress={() => router.push('/onboarding/language')} />
        <Button testID="have-account" label={t('welcome.haveAccount')} variant="tonal" onPress={() => router.push('/auth/login')} />
      </View>
      <AppText variant="bodySm" color={colors.textSubtle} align="center">{t('welcome.footnote')}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hero: { height: 180, borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'space-between', padding: 12, backgroundColor: colors.surfaceHigh },
  heroBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  heroCaption: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  sector: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sectorIcon: { width: 56, height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  sectorTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
