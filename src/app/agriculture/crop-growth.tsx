// Crop maturity & growth analysis — design: advanced_crop_maturity_growth_analysis.
// Timeline from sowing, heat units (GDD) from NASA POWER, satellite vigour and the farmer's own stage.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, Chip, ChoiceChips, EmptyState, Header, InfoTile, LineChart, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { useUpdateCrop } from '@/features/agriculture/api';
import { useClimateHistory, useSatellite } from '@/features/intel/api';
import { cropTimeline, gdd } from '@/features/intel/crop';
import { InsightCard } from '@/features/intel/InsightCard';
import { useCropContext } from '@/features/intel/useCropContext';
import { formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';
import type { GrowthStage } from '@/types/database';

const STAGES: GrowthStage[] = ['germination', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest'];

export default function CropGrowth() {
  const { t, i18n } = useTranslation();
  const { crop: cropParam } = useLocalSearchParams<{ crop?: string }>();
  const { loading, crop, farm, pt, weather, picker } = useCropContext(cropParam);
  const tl = crop ? cropTimeline(crop, today()) : null;
  const hist = useClimateHistory(pt?.lat, pt?.lon, Math.min(90, Math.max(7, tl?.days ?? 30)));
  const sat = useSatellite(farm?.id ?? null, !!farm?.boundary);
  const update = useUpdateCrop();
  const ndvi = useMemo(() => [...(sat.data?.observations ?? [])].reverse().filter((o) => o.ndvi_mean != null).map((o) => ({ x: Date.parse(o.acquired_at), y: Number(o.ndvi_mean) })), [sat.data]);
  if (loading) return <Screen><Header title={t('growth.detailTitle')} /><LoadingList /></Screen>;
  if (!crop) return <Screen><Header title={t('growth.detailTitle')} /><EmptyState icon="eco" title={t('irrigation.noCrop')} action={t('dashboard.addCrop')} onAction={() => router.push('/agriculture/crops/new')} /></Screen>;
  return (
    <Screen>
      <Header title={t('growth.detailTitle')} />
      {picker}
      <AppText variant="headlineMd">{crop.name}{crop.variety ? ` · ${crop.variety}` : ''}</AppText>
      {tl ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <InfoTile icon="today" label={t('growth.daysSince')} value={`${tl.days} / ${tl.total}`} />
          <InfoTile icon="agriculture" label={t('growth.expectedHarvest')} value={formatDate(tl.harvest, i18n.language)} />
          <InfoTile icon="timelapse" label={t('growth.estStage')} value={t(`stage.${tl.stage}`)} />
          <InfoTile icon="thermostat" label="GDD" value={hist.data ? String(gdd(hist.data.days)) : '—'} />
        </View>
      ) : <Banner message={t('growth.noSowing')} />}
      <ChoiceChips scroll label={t('growth.yourStage')} value={crop.growth_stage ?? null} onChange={(growth_stage) => update.mutate({ id: crop.id, patch: { growth_stage } })} options={STAGES.map((s) => ({ value: s, label: t(`stage.${s}`) }))} />
      {tl && crop.growth_stage && STAGES.indexOf(crop.growth_stage) < STAGES.indexOf(tl.stage) - 1 && <Banner tone="warning" message={t('growth.behind')} />}
      <SectionHeader title={t('field.satTitle')} />
      {!farm?.boundary ? <Banner message={t('field.needBoundary')} /> : sat.data && !sat.data.configured ? <Banner tone="warning" message={t('field.notConfigured')} /> : ndvi.length > 1 ? (
        <Card style={{ gap: 6 }}>
          <LineChart series={[{ points: ndvi, color: colors.secondary, label: 'NDVI' }]} yMin={0} yMax={1} formatX={(x) => formatDate(new Date(x).toISOString().slice(0, 10), i18n.language, { day: 'numeric', month: 'short' })} />
          <AppText variant="labelSm" color={colors.textSubtle}>{t('growth.ndviNote')}</AppText>
          <SourceBadge source="api" label="Sentinel-2" />
        </Card>
      ) : <Banner message={t('field.noScenes')} />}
      {hist.data && <Chip icon="thermostat" label={t('growth.gddNote', { gdd: gdd(hist.data.days), days: hist.data.days.length })} />}
      <InsightCard kind="crop" id={crop.id} extra={weather.data ? { next_days: weather.data.daily.slice(0, 5).map((d) => ({ date: d.date, max: d.max, rain_mm: d.rain_mm })) } : null} />
    </Screen>
  );
}
