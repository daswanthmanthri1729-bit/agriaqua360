// Wearable collars — design: smart_livestock_wearable_dashboard.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Chip, EmptyState, Header, LoadingList, Screen, SourceBadge } from '@/components';
import { ago } from '@/components/Freshness';
import { deviceStatus, SENSOR_UNITS, useDevices, useRealtime } from '@/features/iot/api';
import { useAnimals } from '@/features/livestock/api';
import { colors } from '@/theme';

export default function Wearables() {
  const { t } = useTranslation();
  const q = useDevices(); const animals = useAnimals();
  useRealtime('sensor_readings', null, [['devices']]);
  if (q.isLoading) return <Screen><Header title={t('herd.wearTitle')} /><LoadingList /></Screen>;
  const collars = (q.data?.devices ?? []).filter((d) => d.kind === 'collar');
  if (!collars.length) return <Screen><Header title={t('herd.wearTitle')} /><EmptyState icon="pets" title={t('herd.noCollars')} text={t('herd.noCollarsText')} action={t('monitor.addDevice')} onAction={() => router.push('/monitor/add')} /></Screen>;
  return (
    <Screen footer={<Button iconLeft="add" label={t('monitor.addDevice')} onPress={() => router.push('/monitor/add')} />}>
      <Header title={t('herd.wearTitle')} />
      {collars.map((d) => {
        const a = animals.data?.find((x) => x.id === d.animal_id);
        const vals = (q.data?.latest ?? []).filter((l) => l.device_id === d.id && l.sensor_type !== 'battery');
        const st = deviceStatus(d);
        return (
          <Card key={d.id} onPress={() => (a ? router.push(`/livestock/animals/${a.id}`) : router.push(`/monitor/device/${d.id}`))} accessibilityLabel={d.name} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText variant="labelLg" style={{ flex: 1 }}>{a ? a.name ?? a.tag_id ?? t(`livestock.species.${a.species}`) : d.name}</AppText>
              {d.is_simulated && <SourceBadge source="simulated" />}
              <Chip tone={st === 'online' ? 'normal' : 'warning'} label={t(`monitor.status.${st}`)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {vals.map((v) => <Chip key={v.sensor_type} tone={v.sensor_type === 'body_temp' && v.value >= 39.5 ? 'error' : 'normal'} label={`${t(`sensors.${v.sensor_type}`)} ${v.value} ${SENSOR_UNITS[v.sensor_type]}`} />)}
              {d.battery_pct != null && <Chip icon="battery-std" tone={d.battery_pct < 20 ? 'warning' : 'normal'} label={`${Math.round(d.battery_pct)}%`} />}
            </View>
            <AppText variant="labelSm" color={colors.textSubtle}>{d.last_seen_at ? ago(d.last_seen_at, t) : t('monitor.neverSeen')}</AppText>
          </Card>
        );
      })}
      <Button variant="secondary" iconLeft="fence" label={t('animal.geofences')} onPress={() => router.push('/livestock/geofence')} />
    </Screen>
  );
}
