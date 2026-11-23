// Alert limits for every sensor — design: advanced_sensor_threshold_alert_configuration.
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, EmptyState, Header, Icon, LoadingList, Screen } from '@/components';
import { SENSOR_UNITS, useAllChannels, useAllThresholds, useDevices } from '@/features/iot/api';
import { ThresholdSheet } from '@/features/iot/ThresholdSheet';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/query';
import { colors } from '@/theme';

export default function Thresholds() {
  const { t } = useTranslation();
  const dq = useDevices(); const ch = useAllChannels(); const th = useAllThresholds();
  const [edit, setEdit] = useState<{ device: string; type: string } | null>(null);
  if (dq.isLoading || ch.isLoading) return <Screen><Header title={t('thresholds.set')} /><LoadingList /></Screen>;
  const sensorDevices = (dq.data?.devices ?? []).filter((d) => (ch.data ?? []).some((c) => c.device_id === d.id && c.kind === 'sensor'));
  if (!sensorDevices.length) return <Screen><Header title={t('thresholds.set')} /><EmptyState icon="tune" title={t('monitor.emptyTitle')} action={t('monitor.addDevice')} onAction={() => router.push('/monitor/add')} /></Screen>;
  const find = (device: string, type: string) => (th.data ?? []).find((x) => x.device_id === device && x.sensor_type === type);
  const toggle = async (id: string, enabled: boolean) => { await supabase.from('sensor_thresholds').update({ enabled }).eq('id', id); queryClient.invalidateQueries({ queryKey: ['device'] }); };
  return (
    <Screen>
      <Header title={t('thresholds.set')} />
      <AppText variant="bodyMd" color={colors.textMuted}>{t('thresholds.help')}</AppText>
      {sensorDevices.map((d) => (
        <Card key={d.id} style={{ gap: 6 }}>
          <AppText variant="labelLg">{d.name}</AppText>
          {(ch.data ?? []).filter((c) => c.device_id === d.id && c.kind === 'sensor').map((c) => {
            const x = find(d.id, c.sensor_type!);
            const u = SENSOR_UNITS[c.sensor_type!];
            return (
              <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}>
                <Pressable accessibilityRole="button" style={{ flex: 1 }} onPress={() => setEdit({ device: d.id, type: c.sensor_type! })}>
                  <AppText variant="bodyMd">{t(`sensors.${c.sensor_type}`)}</AppText>
                  <AppText variant="labelSm" color={x ? colors.text : colors.textSubtle}>
                    {x ? [x.min_value != null && `${t('thresholds.min')} ${x.min_value} ${u}`, x.max_value != null && `${t('thresholds.max')} ${x.max_value} ${u}`].filter(Boolean).join(' · ') : t('fleet.noLimit')}
                  </AppText>
                </Pressable>
                {x && <Switch value={x.enabled} accessibilityLabel={t('fleet.limitOn')} trackColor={{ true: colors.secondary }} onValueChange={(v) => toggle(x.id, v)} />}
                <Icon name="edit" size={18} color={colors.textMuted} />
              </View>
            );
          })}
        </Card>
      ))}
      <ThresholdSheet deviceId={edit?.device ?? ''} sensorType={edit?.type ?? null} existing={edit ? find(edit.device, edit.type) : undefined} onClose={() => setEdit(null)} />
    </Screen>
  );
}
