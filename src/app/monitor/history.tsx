// Sensor history & comparison — designs: advanced_sensor_data_analytics_correlation, advanced_water_quality_sensor_analytics.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, ChoiceChips, EmptyState, ErrorState, Header, LineChart, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { SENSOR_UNITS, useDevice, useDevices, useSeries } from '@/features/iot/api';
import { axisFormat } from '@/lib/dates';
import { colors } from '@/theme';
import type { SeriesPoint } from '@/types/database';

const RANGES = [{ h: 24, k: '24h' }, { h: 168, k: '7d' }, { h: 720, k: '30d' }, { h: 2160, k: '90d' }];

function stats(ps: SeriesPoint[]) {
  if (!ps.length) return null;
  const n = ps.reduce((s, p) => s + p.n, 0);
  return { min: Math.min(...ps.map((p) => Number(p.min_value))), max: Math.max(...ps.map((p) => Number(p.max_value))), avg: Math.round((ps.reduce((s, p) => s + Number(p.avg_value) * p.n, 0) / n) * 100) / 100, n, sources: [...new Set(ps.flatMap((p) => p.sources))] };
}

export default function SensorHistory() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ device?: string; sensor?: string }>();
  const list = useDevices();
  const [deviceId, setDeviceId] = useState<string | null>(params.device ?? null);
  const dev = deviceId ?? list.data?.devices[0]?.id ?? null;
  const detail = useDevice(dev ?? '');
  const types = (detail.data?.channels ?? []).filter((c) => c.kind === 'sensor').map((c) => c.sensor_type!);
  const [a, setA] = useState<string | null>(params.sensor ?? null);
  const [b, setB] = useState<string | null>(null);
  const [hours, setHours] = useState(168);
  const first = a && types.includes(a) ? a : types[0] ?? null;
  const sa = useSeries(dev && first ? { sensorType: first, hours, deviceId: dev } : null);
  const sb = useSeries(dev && b ? { sensorType: b, hours, deviceId: dev } : null);
  const pts = (d?: SeriesPoint[]) => (d ?? []).map((p) => ({ x: Date.parse(p.bucket), y: Number(p.avg_value), lo: Number(p.min_value), hi: Number(p.max_value) }));
  const pa = useMemo(() => pts(sa.data), [sa.data]);
  const pb = useMemo(() => pts(sb.data), [sb.data]);
  const fx = axisFormat(hours, i18n.language);

  if (list.isLoading) return <Screen><Header /><LoadingList /></Screen>;
  if (list.error && !list.data) return <Screen><Header /><ErrorState onRetry={() => list.refetch()} /></Screen>;
  if (!list.data?.devices.length) return <Screen><Header title={t('history.sensorTitle')} /><EmptyState icon="sensors" title={t('monitor.emptyTitle')} text={t('monitor.emptyText')} /></Screen>;

  const block = (type: string, p: typeof pa, s: SeriesPoint[] | undefined, loading: boolean, color: string) => {
    const st = stats(s ?? []);
    return (
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <AppText variant="labelLg" style={{ flex: 1 }}>{t(`sensors.${type}`)} ({SENSOR_UNITS[type]})</AppText>
          {st?.sources.map((src) => <SourceBadge key={src} source={src} />)}
        </View>
        {loading ? <LoadingList count={1} height={180} /> : p.length ? <LineChart series={[{ points: p, color, label: t(`sensors.${type}`) }]} unit={SENSOR_UNITS[type]} formatX={fx} /> : <AppText color={colors.textMuted}>{t('devices.noHistory')}</AppText>}
        {st && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[['min', st.min], ['avg', st.avg], ['max', st.max]].map(([k, v]) => (
              <View key={k as string} style={{ flex: 1, alignItems: 'center' }}>
                <AppText variant="labelSm" color={colors.textSubtle}>{t(`history.${k}`)}</AppText>
                <AppText variant="labelLg">{String(v)} {SENSOR_UNITS[type]}</AppText>
              </View>
            ))}
          </View>
        )}
        {st && <AppText variant="labelSm" color={colors.textSubtle}>{t('history.readings', { count: st.n })}</AppText>}
      </Card>
    );
  };

  return (
    <Screen>
      <Header title={t('history.sensorTitle')} />
      <ChoiceChips scroll label={t('history.device')} value={dev} onChange={(v) => { setDeviceId(v); setA(null); setB(null); }} options={list.data.devices.map((d) => ({ value: d.id, label: d.name }))} />
      {types.length > 0 && <ChoiceChips scroll label={t('history.parameter')} value={first} onChange={setA} options={types.map((x) => ({ value: x, label: t(`sensors.${x}`) }))} />}
      <ChoiceChips value={String(hours)} onChange={(v) => setHours(Number(v))} options={RANGES.map((r) => ({ value: String(r.h), label: t(`range.${r.k}`) }))} />
      {first && block(first, pa, sa.data, sa.isLoading, colors.primary)}
      <SectionHeader title={t('history.compare')} />
      <AppText variant="bodySm" color={colors.textMuted}>{t('history.compareHelp')}</AppText>
      <ChoiceChips scroll value={b} onChange={(v) => setB(v === b ? null : v)} options={types.filter((x) => x !== first).map((x) => ({ value: x, label: t(`sensors.${x}`) }))} />
      {b && block(b, pb, sb.data, sb.isLoading, colors.water)}
    </Screen>
  );
}
