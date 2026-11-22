import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Icon, SourceBadge } from '@/components';
import { ago } from '@/components/Freshness';
import { colors } from '@/theme';
import type { SensorAlert, SensorDevice } from '@/types/database';
import { SENSOR_UNITS } from './api';

const ICON = { low: 'south', high: 'north', offline: 'wifi-off', battery: 'battery-alert', geofence: 'fence', rejected: 'report-problem' } as const;

export function alertTitle(a: SensorAlert, t: (k: string, o?: Record<string, unknown>) => string) {
  const p = a.sensor_type ? t(`sensors.${a.sensor_type}`) : '';
  const u = a.sensor_type ? SENSOR_UNITS[a.sensor_type] ?? '' : '';
  return t(`alerts.kind.${a.kind}`, { param: p, value: a.value != null ? `${a.value} ${u}` : '', limit: a.limit_value != null ? `${a.limit_value} ${u}` : '' });
}

export function AlertRow({ alert: a, device, onAck }: { alert: SensorAlert; device?: SensorDevice; onAck?: () => void }) {
  const { t } = useTranslation();
  const tone = a.status === 'resolved' ? colors.textSubtle : a.kind === 'offline' || a.kind === 'battery' ? colors.warning : colors.error;
  return (
    <Pressable accessibilityRole="button" onPress={() => a.device_id && router.push(`/monitor/device/${a.device_id}`)}
      style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 56, paddingVertical: 4 }}>
      <Icon name={ICON[a.kind]} color={tone} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="labelLg" color={a.status === 'resolved' ? colors.textMuted : colors.text} numberOfLines={2}>{alertTitle(a, t as never)}</AppText>
        <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>
          {device?.name ? `${device.name} · ` : ''}{ago(a.created_at, t)}{a.status !== 'open' ? ` · ${t(`alerts.status.${a.status}`)}` : ''}
        </AppText>
      </View>
      {a.source === 'simulated' && <SourceBadge source="simulated" />}
      {onAck && a.status === 'open' && <Button compact variant="text" label={t('alerts.ack')} onPress={onAck} />}
    </Pressable>
  );
}
