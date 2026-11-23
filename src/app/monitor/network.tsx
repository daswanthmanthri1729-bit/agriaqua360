// Network & connectivity — design: iot_gateway_network_connectivity_management.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, Chip, EmptyState, Header, Icon, LoadingList, Screen, SectionHeader } from '@/components';
import { ago } from '@/components/Freshness';
import { deviceStatus, signal, useDevices } from '@/features/iot/api';
import { colors } from '@/theme';

const BARS = { good: 'signal-cellular-alt', fair: 'signal-cellular-alt-2-bar', weak: 'signal-cellular-alt-1-bar' } as const;

export default function Network() {
  const { t } = useTranslation();
  const q = useDevices();
  if (q.isLoading) return <Screen><Header title={t('fleet.networkTitle')} /><LoadingList /></Screen>;
  const devices = (q.data?.devices ?? []).filter((d) => !d.is_simulated);
  if (!devices.length) return <Screen><Header title={t('fleet.networkTitle')} /><EmptyState icon="router" title={t('fleet.noReal')} text={t('fleet.noRealText')} /></Screen>;
  const rssi = devices.map((d) => d.rssi_dbm).filter((x): x is number => x != null);
  const avg = rssi.length ? Math.round(rssi.reduce((a, b) => a + b, 0) / rssi.length) : null;
  const offline = devices.filter((d) => deviceStatus(d) === 'offline');
  const byTransport = (tr: string) => devices.filter((d) => d.transport === tr).length;
  return (
    <Screen>
      <Header title={t('fleet.networkTitle')} />
      <Card style={{ flexDirection: 'row', gap: 8 }}>
        {[[t('fleet.avgSignal'), avg != null ? `${avg} dBm` : '—'], [t('monitor.offline'), String(offline.length)], ['HTTPS', String(byTransport('https'))], ['MQTT', String(byTransport('mqtt'))]].map(([l, v]) => (
          <View key={l} style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="labelSm" color={colors.textSubtle}>{l}</AppText>
            <AppText variant="headlineSm">{v}</AppText>
          </View>
        ))}
      </Card>
      {offline.length > 0 && <Banner tone="warning" message={t('fleet.offlineHelp')} />}
      <SectionHeader title={t('monitor.devices')} />
      {devices.map((d) => {
        const s = signal(d.rssi_dbm);
        const st = deviceStatus(d);
        return (
          <Card key={d.id} onPress={() => router.push(`/monitor/device/${d.id}`)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }} accessibilityLabel={d.name}>
            <Icon name={s ? BARS[s] : 'signal-cellular-off'} color={s === 'good' ? colors.secondary : s === 'fair' ? colors.warning : colors.error} />
            <View style={{ flex: 1 }}>
              <AppText variant="labelLg" numberOfLines={1}>{d.name}</AppText>
              <AppText variant="bodySm" color={colors.textMuted}>
                {d.rssi_dbm != null ? `${d.rssi_dbm} dBm (${t(`fleet.signal.${s}`)})` : t('fleet.noSignal')} · {t('fleet.every', { n: Math.round(d.reporting_interval_s / 60) })} · {d.last_seen_at ? ago(d.last_seen_at, t) : t('monitor.neverSeen')}
              </AppText>
            </View>
            {d.battery_pct != null && <Chip tone={d.battery_pct < 20 ? 'warning' : 'normal'} icon="battery-std" label={`${Math.round(d.battery_pct)}%`} />}
            <Chip tone={st === 'online' ? 'normal' : 'warning'} label={t(`monitor.status.${st}`)} />
          </Card>
        );
      })}
      <AppText variant="bodySm" color={colors.textMuted}>{t('fleet.networkTips')}</AppText>
    </Screen>
  );
}
