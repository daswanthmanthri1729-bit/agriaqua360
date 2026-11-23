// Irrigation zones & water distribution — design: irrigation_zone_water_distribution_monitor.
// Each valve is a zone; water used comes from controllers' flow meters (water_flow sensor) when fitted.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, BarChart, Card, Chip, EmptyState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { ago } from '@/components/Freshness';
import { useEquipment, useRealtime, useSeries } from '@/features/iot/api';
import { formatStamp } from '@/lib/dates';
import { colors } from '@/theme';

function Flow({ deviceId, name }: { deviceId: string; name?: string }) {
  const { t, i18n } = useTranslation();
  const s = useSeries({ sensorType: 'water_flow', hours: 168, deviceId });
  const byDay = new Map<string, number>();
  (s.data ?? []).forEach((p) => { const d = p.bucket.slice(0, 10); byDay.set(d, (byDay.get(d) ?? 0) + Number(p.avg_value) * p.n); });
  if (!byDay.size) return null;
  const total = [...byDay.values()].reduce((a, b) => a + b, 0);
  return (
    <Card style={{ gap: 6 }}>
      <AppText variant="labelLg">{name} · {t('fleet.water7d', { litres: Math.round(total).toLocaleString('en-IN') })}</AppText>
      <BarChart bars={[...byDay.entries()].map(([d, v]) => ({ label: formatStamp(d, i18n.language, { weekday: 'short' }), value: v, color: colors.water }))} unit="L" height={120} formatY={(y) => (y >= 1000 ? `${Math.round(y / 1000)}k` : `${Math.round(y)}`)} />
    </Card>
  );
}

export default function Zones() {
  const { t } = useTranslation();
  const eq = useEquipment();
  useRealtime('device_channels', null, [['equipment']]);
  if (eq.isLoading) return <Screen><Header title={t('fleet.zonesTitle')} /><LoadingList /></Screen>;
  const valves = (eq.data ?? []).filter((c) => c.actuator_type === 'valve' || c.actuator_type === 'pump');
  if (!valves.length) return <Screen><Header title={t('fleet.zonesTitle')} /><EmptyState icon="tune" title={t('fleet.noZones')} text={t('fleet.controllerText')} action={t('monitor.addDevice')} onAction={() => router.push('/monitor/add')} /></Screen>;
  const controllers = [...new Map(valves.map((v) => [v.device_id, v.device?.name])).entries()];
  return (
    <Screen>
      <Header title={t('fleet.zonesTitle')} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {valves.map((v) => (
          <Card key={v.id} onPress={() => router.push(`/monitor/device/${v.device_id}`)} accessibilityLabel={v.label ?? v.channel}
            style={{ flexGrow: 1, flexBasis: '45%', gap: 4, borderColor: v.state === 'on' ? colors.secondary : colors.border, borderWidth: 2 }}>
            <AppText variant="labelLg" numberOfLines={1}>{v.label ?? v.channel}</AppText>
            <Chip tone={v.state === 'on' ? 'normal' : 'dark'} label={t(`equipment.state.${v.state ?? 'unknown'}`)} />
            <AppText variant="labelSm" color={colors.textSubtle}>{t(`equipment.types.${v.actuator_type}`)}{v.state_at ? ` · ${ago(v.state_at, t)}` : ''}</AppText>
          </Card>
        ))}
      </View>
      <SectionHeader title={t('fleet.waterUse')} />
      {controllers.map(([id, name]) => <Flow key={id} deviceId={id} name={name} />)}
      <AppText variant="bodySm" color={colors.textMuted}>{t('fleet.flowHelp')}</AppText>
    </Screen>
  );
}
