// Pond predictions — design: ai_aquaculture_predictions. Short-term oxygen/temperature trend from sensors + growth outlook.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, Chip, EmptyState, Header, LineChart, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { useFishRecords } from '@/features/aquaculture/api';
import { growthRate, pondPerformance, projectLinear } from '@/features/aquaculture/performance';
import { usePondPick } from '@/features/aquaculture/usePondPick';
import { useSeries } from '@/features/iot/api';
import { addDays, axisFormat, formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';

export default function AquaPredictions() {
  const { t, i18n } = useTranslation();
  const { loading, pond, picker } = usePondPick();
  const dox = useSeries(pond ? { sensorType: 'water_do', hours: 12, pondId: pond.id } : null);
  const temp = useSeries(pond ? { sensorType: 'water_temp', hours: 12, pondId: pond.id } : null);
  const recs = useFishRecords(pond?.id ?? '');
  const doPts = useMemo(() => (dox.data ?? []).map((p) => ({ x: Date.parse(p.bucket), y: Number(p.avg_value) })), [dox.data]);
  const tPts = useMemo(() => (temp.data ?? []).map((p) => ({ x: Date.parse(p.bucket), y: Number(p.avg_value) })), [temp.data]);
  if (loading) return <Screen><Header title={t('aquaX.predTitle')} /><LoadingList /></Screen>;
  if (!pond) return <Screen><Header title={t('aquaX.predTitle')} /><EmptyState icon="water" title={t('aquaX.noPond')} action={t('aquaX.addPond')} onAction={() => router.push('/aquaculture/ponds')} /></Screen>;
  const doProj = projectLinear(doPts, 6), tProj = projectLinear(tPts, 6);
  const sim = (dox.data ?? []).some((p) => p.sources.includes('simulated'));
  const samples = (recs.data ?? []).filter((r) => r.record_type === 'sampling' && r.avg_weight_g != null).map((r) => ({ recorded_on: r.recorded_on, avg_weight_g: Number(r.avg_weight_g) }));
  const g = growthRate(samples, 25);
  const perf = pondPerformance(pond, recs.data ?? []);
  return (
    <Screen>
      <Header title={t('aquaX.predTitle')} />
      {picker}
      <SectionHeader title={t('aquaX.next6h')} />
      {dox.isLoading ? <LoadingList count={1} /> : doProj ? (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Chip tone={doProj.value < 4 ? 'error' : 'normal'} icon="bubble-chart" label={`DO → ${doProj.value} mg/L`} />
            {tProj && <Chip icon="thermostat" label={`${t('sensors.water_temp')} → ${tProj.value}°C`} />}
            {sim && <SourceBadge source="simulated" />}
          </View>
          {doProj.value < 4 && <Banner tone="error" message={t('aquaX.doDropping')} />}
          <LineChart series={[{ points: doPts, color: colors.water, label: 'DO' }, { points: doPts.length ? [doPts.at(-1)!, { x: doPts.at(-1)!.x + 6 * 3600_000, y: doProj.value }] : [], color: colors.warning, dashed: true, label: t('aquaX.projection') }]}
            unit="mg/L" limits={[{ y: 4, label: '4' }]} formatX={axisFormat(24, i18n.language)} />
          <AppText variant="labelSm" color={colors.textSubtle}>{t('aquaX.projNote', { rate: doProj.perHour })}</AppText>
        </Card>
      ) : <Banner message={t('aquaX.needSensor')} />}
      <SectionHeader title={t('aquaX.growthOutlook')} />
      <Card style={{ gap: 6 }}>
        {g ? (
          <>
            <AppText variant="bodyMd">{t('aquaX.adgLine', { adg: g.adg, current: g.current })}</AppText>
            {perf.biomassKg != null && g.adg > 0 && <AppText variant="bodyMd">{t('aquaX.biomass30', { kg: Math.round((perf.alive * (g.current + g.adg * 30)) / 1000), date: formatDate(addDays(today(), 30), i18n.language) })}</AppText>}
          </>
        ) : <AppText variant="bodyMd" color={colors.textMuted}>{t('aquaX.needTwoSamples')}</AppText>}
        <SourceBadge source="ai_estimate" label={t('aquaX.trendEstimate')} />
      </Card>
    </Screen>
  );
}
