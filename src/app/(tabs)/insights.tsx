// Insights tab — designs: unified_ai_prediction_dashboard, market_price_intelligence_dashboard (snapshot),
// farm_financial_intelligence_dashboard, government_schemes_subsidy_discovery_dashboard, performance_analytics.
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Banner, Card, Icon, IconName, LogoMark, SectionHeader, Skeleton } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { useMarketPrices } from '@/features/intel/api';
import { commodityFor } from '@/features/intel/commodity';
import { useSession } from '@/store/session';
import { queryClient } from '@/lib/query';
import { colors, radius, space } from '@/theme';

const TILES: { key: string; icon: IconName; href: string; color?: string }[] = [
  { key: 'market', icon: 'storefront', href: '/insights/market' },
  { key: 'outlook', icon: 'trending-up', href: '/insights/outlook' },
  { key: 'finance', icon: 'account-balance-wallet', href: '/insights/finance' },
  { key: 'schemes', icon: 'account-balance', href: '/insights/schemes' },
  { key: 'soil', icon: 'layers', href: '/agriculture/soil' },
  { key: 'irrigation', icon: 'water-drop', href: '/agriculture/irrigation' },
  { key: 'field', icon: 'satellite-alt', href: '/agriculture/field' },
  { key: 'weather', icon: 'thunderstorm', href: '/agriculture/weather' },
  { key: 'sensors', icon: 'show-chart', href: '/monitor/history' },
  { key: 'reports', icon: 'summarize', href: '/reports' },
];

export default function Insights() {
  const { t } = useTranslation();
  const profile = useSession((s) => s.profile);
  const crops = useCrops();
  const growing = (crops.data ?? []).filter((c) => c.status === 'growing' || c.status === 'planned');
  const commodity = growing.map((c) => commodityFor(c.name)).find(Boolean) ?? null;
  const prices = useMarketPrices(commodity, profile?.state ?? null, 14);
  const top = prices.data?.markets[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={() => queryClient.invalidateQueries({ queryKey: ['market'] })} colors={[colors.primary]} />}>
        <View style={styles.row}>
          <LogoMark size={40} />
          <AppText variant="display" accessibilityRole="header" style={{ flex: 1 }}>{t('insights.title')}</AppText>
        </View>
        <AppText variant="bodyMd" color={colors.textMuted}>{t('insights.subtitle')}</AppText>

        {commodity && (
          <>
            <SectionHeader title={t('insights.mandiToday')} action={t('common.seeAll')} onAction={() => router.push({ pathname: '/insights/market', params: { commodity } })} />
            {prices.isLoading ? <Skeleton height={90} /> : prices.data && !prices.data.configured ? <Banner message={t('market.notConfigured')} /> : top ? (
              <Card onPress={() => router.push({ pathname: '/insights/market', params: { commodity } })} style={{ gap: 4 }} accessibilityLabel={`${commodity} ₹${top.modal_price}`}>
                <AppText variant="labelMd" color={colors.textSubtle}>{commodity} · {top.market}</AppText>
                <View style={[styles.row, { alignItems: 'baseline' }]}>
                  <AppText variant="headlineLg">₹{top.modal_price?.toLocaleString('en-IN')}</AppText>
                  <AppText variant="labelMd" color={colors.textMuted}>/{t('market.quintal')}</AppText>
                  {top.change_7d != null && <AppText variant="labelLg" color={top.change_7d >= 0 ? colors.secondary : colors.error}>{top.change_7d >= 0 ? '▲' : '▼'} ₹{Math.abs(top.change_7d)}</AppText>}
                </View>
                <AppText variant="labelSm" color={colors.textSubtle}>{t('market.modalOn', { date: top.arrival_date })}</AppText>
              </Card>
            ) : <Banner message={t('market.noPrices', { commodity })} />}
          </>
        )}

        <SectionHeader title={t('insights.tools')} />
        <View style={styles.grid}>
          {TILES.map((x) => (
            <Pressable key={x.key} accessibilityRole="button" accessibilityLabel={t(`insights.tiles.${x.key}`)} onPress={() => router.push(x.href as never)}
              style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.surfaceLow }]}>
              <View style={styles.icon}><Icon name={x.icon} color={colors.primaryDeep} /></View>
              <AppText variant="labelLg" numberOfLines={2}>{t(`insights.tiles.${x.key}`)}</AppText>
              <AppText variant="bodySm" color={colors.textMuted} numberOfLines={2}>{t(`insights.tileText.${x.key}`)}</AppText>
            </Pressable>
          ))}
        </View>
        <Banner message={t('insights.disclaimer')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '45%', minHeight: 120, padding: 12, gap: 6, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
});
