// Real-time animal health sensors — design: real_time_animal_health_sensor_monitor. Whole herd, fever first.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, Chip, EmptyState, Header, LoadingList, Screen } from '@/components';
import { ago } from '@/components/Freshness';
import { SENSOR_UNITS, useDevices, useRealtime } from '@/features/iot/api';
import { useAnimals } from '@/features/livestock/api';
import { colors } from '@/theme';

export default function AnimalSensors() {
  const { t } = useTranslation();
  const q = useDevices(); const animals = useAnimals();
  useRealtime('sensor_readings', null, [['devices']]);
  if (q.isLoading || animals.isLoading) return <Screen><Header title={t('herd.sensorsTitle')} /><LoadingList /></Screen>;
  const rows = (animals.data ?? []).map((a) => ({ a, vals: (q.data?.latest ?? []).filter((l) => l.animal_id === a.id) })).filter((r) => r.vals.length);
  if (!rows.length) return <Screen><Header title={t('herd.sensorsTitle')} /><EmptyState icon="monitor-heart" title={t('herd.noCollars')} text={t('herd.noCollarsText')} action={t('monitor.addDevice')} onAction={() => router.push('/monitor/add')} /></Screen>;
  const temp = (r: (typeof rows)[number]) => r.vals.find((v) => v.sensor_type === 'body_temp')?.value ?? 0;
  rows.sort((x, y) => temp(y) - temp(x));
  const fever = rows.filter((r) => temp(r) >= 39.5);
  return (
    <Screen>
      <Header title={t('herd.sensorsTitle')} />
      {fever.length > 0 ? <Banner tone="error" message={t('herd.feverN', { count: fever.length })} /> : <Banner tone="success" message={t('herd.allNormal')} />}
      {rows.map(({ a, vals }) => (
        <Card key={a.id} onPress={() => router.push(`/livestock/animals/${a.id}`)} accessibilityLabel={a.name ?? a.tag_id ?? ''} style={{ gap: 6 }}>
          <AppText variant="labelLg">{a.name ?? a.tag_id} · {t(`livestock.species.${a.species}`)}</AppText>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {vals.filter((v) => v.sensor_type !== 'battery').map((v) => (
              <Chip key={v.sensor_type} tone={v.sensor_type === 'body_temp' && v.value >= 39.5 ? 'error' : v.source === 'simulated' ? 'warning' : 'normal'} label={`${t(`sensors.${v.sensor_type}`)} ${v.value} ${SENSOR_UNITS[v.sensor_type]}`} />
            ))}
          </View>
          <AppText variant="labelSm" color={colors.textSubtle}>{ago(vals[0].recorded_at, t)}{vals.some((v) => v.source === 'simulated') ? ` · ${t('source.simulated')}` : ''}</AppText>
        </Card>
      ))}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('herd.feverNote')}</AppText>
    </Screen>
  );
}
