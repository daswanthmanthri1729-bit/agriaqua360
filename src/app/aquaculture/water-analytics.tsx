// Water-quality analytics — design: advanced_water_quality_sensor_analytics. All parameters for a pond, with safe bands.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, ChoiceChips, EmptyState, Header, LineChart, LoadingList, Screen, SourceBadge } from '@/components';
import { useReadings } from '@/features/aquaculture/api';
import { usePondPick } from '@/features/aquaculture/usePondPick';
import { level, RANGES } from '@/features/aquaculture/waterQuality';
import { formatDate, isoDate } from '@/lib/dates';
import { colors } from '@/theme';

const PARAMS = ['dissolved_oxygen_mgl', 'temperature_c', 'ph', 'ammonia_mgl', 'salinity_ppt', 'turbidity_ntu', 'water_level_cm'] as const;
const UNIT: Record<string, string> = { dissolved_oxygen_mgl: 'mg/L', temperature_c: '°C', ph: '', ammonia_mgl: 'mg/L', salinity_ppt: 'ppt', turbidity_ntu: 'NTU', water_level_cm: 'cm' };
const LABEL: Record<string, string> = { turbidity_ntu: 'sensors.turbidity', water_level_cm: 'sensors.water_level' };

export default function WaterAnalytics() {
  const { t, i18n } = useTranslation();
  const { pond: pondParam } = useLocalSearchParams<{ pond?: string }>();
  const { loading, pond, picker } = usePondPick(pondParam);
  const readings = useReadings(pond?.id);
  const [days, setDays] = useState(30);
  const rows = useMemo(() => [...(readings.data ?? [])].filter((r) => Date.parse(r.recorded_at) > Date.now() - days * 86_400_000).reverse(), [readings.data, days]);
  if (loading) return <Screen><Header title={t('aquaX.analyticsTitle')} /><LoadingList /></Screen>;
  if (!pond) return <Screen><Header title={t('aquaX.analyticsTitle')} /><EmptyState icon="water" title={t('aquaX.noPond')} action={t('aquaX.addPond')} onAction={() => router.push('/aquaculture/ponds')} /></Screen>;
  const sources = [...new Set(rows.map((r) => r.source ?? 'manual'))];
  return (
    <Screen>
      <Header title={t('aquaX.analyticsTitle')} />
      {picker}
      <ChoiceChips value={String(days)} onChange={(v) => setDays(Number(v))} options={[7, 30, 90].map((n) => ({ value: String(n), label: t(`range.${n}d`) }))} />
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{sources.map((s) => <SourceBadge key={s} source={s as 'manual'} />)}</View>
      {readings.isLoading ? <LoadingList count={3} height={150} /> : !rows.length ? <EmptyState icon="science" title={t('aqua.noReadings')} /> : PARAMS.map((p) => {
        const pts = rows.filter((r) => r[p] != null).map((r) => ({ x: Date.parse(r.recorded_at), y: Number(r[p]) }));
        if (pts.length < 2) return null;
        const r = RANGES[p as keyof typeof RANGES];
        const last = pts.at(-1)!.y;
        const lv = level(p as never, last);
        return (
          <Card key={p} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText variant="labelLg" style={{ flex: 1 }}>{t(LABEL[p] ?? `water.params.${p}`)} {UNIT[p] ? `(${UNIT[p]})` : ''}</AppText>
              <AppText variant="labelLg" color={lv === 'bad' ? colors.error : lv === 'warn' ? colors.warning : colors.text}>{last}</AppText>
            </View>
            <LineChart series={[{ points: pts, color: colors.water, label: t(LABEL[p] ?? `water.params.${p}`) }]} height={140}
              limits={r ? [r.ok[0] > 0 && { y: r.ok[0], label: t('thresholds.min'), color: colors.warning }, Number.isFinite(r.ok[1]) && { y: r.ok[1], label: t('thresholds.max'), color: colors.warning }].filter(Boolean) as { y: number; label: string; color: string }[] : []}
              formatX={(x) => formatDate(isoDate(new Date(x)), i18n.language, { day: 'numeric', month: 'short' })} />
          </Card>
        );
      })}
    </Screen>
  );
}
