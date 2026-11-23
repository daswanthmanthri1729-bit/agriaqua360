// Sensor intelligence — design: sensor_intelligence. Every live value across the farm, grouped by parameter, checked against limits.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, Chip, EmptyState, Header, LoadingList, Screen, SourceBadge } from '@/components';
import { ago } from '@/components/Freshness';
import { SENSOR_UNITS, useAllThresholds, useDevices, useRealtime } from '@/features/iot/api';
import { colors } from '@/theme';

export default function Sensors() {
  const { t } = useTranslation();
  const q = useDevices();
  const th = useAllThresholds();
  useRealtime('sensor_readings', null, [['devices']]);
  if (q.isLoading) return <Screen><Header title={t('fleet.sensorsTitle')} /><LoadingList /></Screen>;
  const latest = q.data?.latest ?? [];
  if (!latest.length) return <Screen><Header title={t('fleet.sensorsTitle')} /><EmptyState icon="sensors" title={t('monitor.emptyTitle')} text={t('monitor.emptyText')} action={t('monitor.addDevice')} onAction={() => router.push('/monitor/add')} /></Screen>;
  const types = [...new Set(latest.map((l) => l.sensor_type))];
  const name = (id: string) => q.data?.devices.find((d) => d.id === id)?.name ?? '';
  const state = (deviceId: string, type: string, v: number) => {
    const x = (th.data ?? []).find((h) => h.device_id === deviceId && h.sensor_type === type && h.enabled);
    if (!x) return null;
    return x.min_value != null && v < x.min_value ? 'low' : x.max_value != null && v > x.max_value ? 'high' : 'ok';
  };
  return (
    <Screen>
      <Header title={t('fleet.sensorsTitle')} />
      <AppText variant="bodyMd" color={colors.textMuted}>{t('fleet.sensorsHelp')}</AppText>
      {types.map((type) => (
        <Card key={type} style={{ gap: 8 }}>
          <AppText variant="labelLg">{t(`sensors.${type}`)} ({SENSOR_UNITS[type]})</AppText>
          {latest.filter((l) => l.sensor_type === type).map((l) => {
            const s = state(l.device_id, type, l.value);
            return (
              <View key={l.device_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyMd" onPress={() => router.push({ pathname: '/monitor/history', params: { device: l.device_id, sensor: type } })}>{name(l.device_id)}</AppText>
                  <AppText variant="labelSm" color={colors.textSubtle}>{ago(l.recorded_at, t)}</AppText>
                </View>
                {l.source !== 'sensor' && <SourceBadge source={l.source} />}
                <AppText variant="labelLg" color={s === 'low' || s === 'high' ? colors.error : colors.text}>{l.value} {SENSOR_UNITS[type]}</AppText>
                {s && <Chip tone={s === 'ok' ? 'normal' : 'error'} label={t(`fleet.state.${s}`)} />}
              </View>
            );
          })}
        </Card>
      ))}
    </Screen>
  );
}
