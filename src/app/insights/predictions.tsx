// Unified prediction dashboard — design: unified_ai_prediction_dashboard. All forward-looking estimates in one place.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, Chip, Header, Icon, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { kc } from '@/features/intel/agronomy';
import { useForecasts } from '@/features/intel/api';
import { cropTimeline } from '@/features/intel/crop';
import { useWeather, useWeatherTarget } from '@/features/weather/api';
import { ago } from '@/components/Freshness';
import { formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';

const rupees = (n: number | null) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);

export default function Predictions() {
  const { t, i18n } = useTranslation();
  const crops = useCrops(); const fc = useForecasts(); const w = useWeather(useWeatherTarget());
  const growing = (crops.data ?? []).filter((c) => c.status === 'growing');
  const et0 = (w.data?.daily ?? []).slice(0, 3).reduce((s, d) => s + (d.et0_mm ?? 0), 0);
  return (
    <Screen>
      <Header title={t('pred.title')} />
      <Banner message={t('insights.disclaimer')} />
      <SectionHeader title={t('pred.harvests')} action={t('common.seeAll')} onAction={() => router.push('/agriculture/harvest-readiness')} />
      {crops.isLoading ? <LoadingList count={1} /> : growing.length ? growing.map((c) => {
        const tl = cropTimeline(c, today());
        return (
          <Card key={c.id} onPress={() => router.push({ pathname: '/agriculture/yield', params: { crop: c.id } })} accessibilityLabel={c.name} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="agriculture" color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="labelLg">{c.name}</AppText>
              <AppText variant="bodySm" color={colors.textMuted}>{tl ? `${formatDate(tl.harvest, i18n.language)} · ${t('harvest.daysLeft', { count: tl.daysLeft })}` : t('growth.noSowing')}</AppText>
            </View>
            {et0 > 0 && <Chip icon="water-drop" label={t('pred.water3', { mm: Math.round(et0 * kc(c.name, c.growth_stage)) })} />}
          </Card>
        );
      }) : <AppText color={colors.textMuted}>{t('irrigation.noCrop')}</AppText>}
      <SectionHeader title={t('pred.prices')} action={t('insights.tiles.outlook')} onAction={() => router.push('/insights/outlook')} />
      {fc.data?.length ? fc.data.slice(0, 6).map((f) => (
        <Card key={f.id} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppText variant="labelLg" style={{ flex: 1 }}>{f.commodity}</AppText>
            {f.basis.uncertainty && <Chip tone={f.basis.uncertainty === 'low' ? 'normal' : 'warning'} label={t(`outlook.uncertainty.${f.basis.uncertainty}`)} />}
          </View>
          <AppText variant="bodyMd">{rupees(f.price_low)} – {rupees(f.price_high)} ({t('outlook.likely')} {rupees(f.price_mid)})</AppText>
          <AppText variant="labelSm" color={colors.textSubtle}>{ago(f.generated_at, t)}</AppText>
        </Card>
      )) : <AppText color={colors.textMuted}>{t('pred.noPrice')}</AppText>}
      <SectionHeader title={t('pred.more')} />
      <Card style={{ gap: 4 }}>
        {([['aquaX.predTitle', '/aquaculture/predictions'], ['herd.prodTitle', '/livestock/productivity'], ['wx.waterTitle', '/agriculture/water-forecast'], ['yield.qtyTitle', '/agriculture/harvest-quantity']] as const).map(([k, href]) => (
          <AppText key={href} variant="bodyLg" color={colors.primary} onPress={() => router.push(href)} style={{ paddingVertical: 8 }}>{t(k)} ›</AppText>
        ))}
      </Card>
      <SourceBadge source="ai_estimate" label={t('pred.estimates')} />
    </Screen>
  );
}
