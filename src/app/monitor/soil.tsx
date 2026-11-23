// Live soil sensors — design: live_soil_sensors.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, ChoiceChips, EmptyState, Header, LineChart, LoadingList, Screen, SourceBadge } from '@/components';
import { ago } from '@/components/Freshness';
import { SENSOR_UNITS, useDevices, useRealtime, useSeries } from '@/features/iot/api';
import { axisFormat } from '@/lib/dates';
import { colors, radius } from '@/theme';

const SOIL = ['soil_moisture', 'soil_temp', 'soil_ph', 'soil_n', 'soil_p', 'soil_k'];

export default function LiveSoil() {
  const { t, i18n } = useTranslation();
  const q = useDevices();
  useRealtime('sensor_readings', null, [['devices'], ['series']]);
  const fields = (q.data?.devices ?? []).filter((d) => d.kind === 'field_node');
  const [dev, setDev] = useState<string | null>(null);
  const id = dev ?? fields[0]?.id ?? null;
  const vals = (q.data?.latest ?? []).filter((l) => l.device_id === id && SOIL.includes(l.sensor_type));
  const [param, setParam] = useState('soil_moisture');
  const series = useSeries(id ? { sensorType: param, hours: 168, deviceId: id } : null);
  const pts = useMemo(() => (series.data ?? []).map((p) => ({ x: Date.parse(p.bucket), y: Number(p.avg_value), lo: Number(p.min_value), hi: Number(p.max_value) })), [series.data]);
  if (q.isLoading) return <Screen><Header title={t('fleet.soilTitle')} /><LoadingList /></Screen>;
  if (!fields.length) return <Screen><Header title={t('fleet.soilTitle')} /><EmptyState icon="grass" title={t('fleet.noSoil')} text={t('monitor.emptyText')} action={t('monitor.addDevice')} onAction={() => router.push('/monitor/add')} /></Screen>;
  return (
    <Screen>
      <Header title={t('fleet.soilTitle')} />
      {fields.length > 1 && <ChoiceChips scroll value={id} onChange={setDev} options={fields.map((d) => ({ value: d.id, label: d.name }))} />}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {vals.map((v) => (
          <View key={v.sensor_type} style={{ flexGrow: 1, flexBasis: '30%', padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <AppText variant="labelSm" color={colors.textSubtle}>{t(`sensors.${v.sensor_type}`)}</AppText>
            <AppText variant="headlineSm">{v.value} <AppText variant="labelMd" color={colors.textMuted}>{SENSOR_UNITS[v.sensor_type]}</AppText></AppText>
            <AppText variant="labelSm" color={colors.textSubtle}>{ago(v.recorded_at, t)}</AppText>
          </View>
        ))}
      </View>
      {vals[0] && <SourceBadge source={vals[0].source} />}
      <Card style={{ gap: 8 }}>
        <ChoiceChips scroll value={param} onChange={setParam} options={vals.map((v) => ({ value: v.sensor_type, label: t(`sensors.${v.sensor_type}`) }))} />
        {series.isLoading ? <LoadingList count={1} height={160} /> : pts.length ? <LineChart series={[{ points: pts, color: colors.primary, label: t(`sensors.${param}`) }]} unit={SENSOR_UNITS[param]} formatX={axisFormat(168, i18n.language)} /> : <AppText color={colors.textMuted}>{t('devices.noHistory')}</AppText>}
      </Card>
      <Button variant="secondary" iconLeft="layers" label={t('dashboard.soil')} onPress={() => router.push('/agriculture/soil')} />
    </Screen>
  );
}
