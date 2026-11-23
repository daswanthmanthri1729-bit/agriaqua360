// Yield & growth prediction — design: ai_crop_yield_growth_prediction.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Card, Chip, EmptyState, Header, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { useHarvests } from '@/features/intel/api';
import { cropTimeline, toQuintal, yieldEstimate } from '@/features/intel/crop';
import { InsightCard } from '@/features/intel/InsightCard';
import { useCropContext } from '@/features/intel/useCropContext';
import { today } from '@/lib/dates';
import { colors } from '@/theme';

export default function YieldPrediction() {
  const { t } = useTranslation();
  const { crop: cropParam } = useLocalSearchParams<{ crop?: string }>();
  const { loading, crop, picker, weather } = useCropContext(cropParam);
  const harvests = useHarvests();
  const history = useMemo(() => (harvests.data ?? []).filter((h) => h.crop && crop && h.crop.name.trim().toLowerCase() === crop.name.trim().toLowerCase() && h.crop.area_acres)
    .map((h) => ({ year: (h.scheduled_for ?? '').slice(0, 4), qtlPerAcre: (toQuintal(h.quantity, h.unit) ?? 0) / h.crop!.area_acres! })).filter((h) => h.qtlPerAcre > 0), [harvests.data, crop]);
  if (loading) return <Screen><Header title={t('yield.title')} /><LoadingList /></Screen>;
  if (!crop) return <Screen><Header title={t('yield.title')} /><EmptyState icon="eco" title={t('irrigation.noCrop')} action={t('dashboard.addCrop')} onAction={() => router.push('/agriculture/crops/new')} /></Screen>;
  const est = yieldEstimate(crop.name, crop.area_acres, history);
  const tl = cropTimeline(crop, today());
  return (
    <Screen>
      <Header title={t('yield.title')} />
      {picker}
      <AppText variant="headlineMd">{crop.name}</AppText>
      {!crop.area_acres ? <Banner tone="warning" message={t('yield.needArea')} /> : !est ? <Banner message={t('yield.noData')} /> : (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <SourceBadge source={est.basis === 'own' ? 'manual' : 'model'} label={t(`yield.basis.${est.basis}`, { count: est.seasons })} />
            {tl && <Chip icon="timelapse" label={t(`stage.${crop.growth_stage ?? tl.stage}`)} />}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[[t('outlook.low'), est.low], [t('outlook.likely'), est.mid], [t('outlook.high'), est.high]].map(([l, v], i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', padding: 8, borderRadius: 12, backgroundColor: i === 1 ? colors.chip : colors.surfaceLow }}>
                <AppText variant="labelSm" color={colors.textSubtle}>{l as string}</AppText>
                <AppText variant="headlineSm">{v as number} q</AppText>
              </View>
            ))}
          </View>
          <AppText variant="bodySm" color={colors.textMuted}>{t('yield.perAcre', { q: est.perAcre, acres: crop.area_acres })}</AppText>
        </Card>
      )}
      {history.length > 0 && (
        <>
          <SectionHeader title={t('yield.history')} />
          <Card><BarChart bars={history.slice(0, 8).reverse().map((h) => ({ label: h.year, value: Math.round(h.qtlPerAcre * 10) / 10 }))} unit="q/acre" formatY={(y) => `${Math.round(y)}`} /></Card>
        </>
      )}
      <InsightCard kind="crop" id={crop.id} extra={{ yield_estimate_qtl: est, next_days: weather.data?.daily.slice(0, 5).map((d) => ({ date: d.date, max: d.max, rain_mm: d.rain_mm })) }} />
      <AppText variant="bodySm" color={colors.textSubtle}>{t('yield.note')}</AppText>
    </Screen>
  );
}
