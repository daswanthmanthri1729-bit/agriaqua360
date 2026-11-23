// Monitor tab — designs: live_pond_sensor_network_device_monitor, iot_gateway_network_connectivity_management,
// sensor_intelligence, smart_farm_automation_dashboard, irrigation_zone_water_distribution_monitor.
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Banner, Button, Card, Chip, EmptyState, ErrorState, Icon, LoadingList, LogoMark, SectionHeader, SourceBadge, HubLinks } from '@/components';
import { deviceStatus, KIND_ICON, SENSOR_UNITS, useDevices, useEquipment, useRealtime, useUpdateAlert } from '@/features/iot/api';
import { AlertRow } from '@/features/iot/AlertRow';
import { ago } from '@/components/Freshness';
import { colors, radius, space } from '@/theme';

export default function Monitor() {
  const { t } = useTranslation();
  const q = useDevices();
  const equipment = useEquipment();
  const ack = useUpdateAlert();
  useRealtime('sensor_readings', null, [['devices']]);
  useRealtime('sensor_alerts', null, [['devices'], ['alerts']]);
  useRealtime('device_channels', null, [['equipment']]);

  const devices = q.data?.devices ?? [];
  const status = devices.map((d) => deviceStatus(d));
  const online = status.filter((s) => s === 'online').length;
  const offline = status.filter((s) => s === 'offline').length;
  const alerts = q.data?.alerts ?? [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => { q.refetch(); equipment.refetch(); }} colors={[colors.primary]} />}>
        <View style={styles.row}>
          <LogoMark size={40} />
          <AppText variant="display" accessibilityRole="header" style={{ flex: 1 }}>{t('monitor.title')}</AppText>
          <Button compact iconLeft="add" label={t('monitor.addDevice')} onPress={() => router.push('/monitor/add')} testID="add-device" />
        </View>

        {q.isLoading ? <LoadingList count={3} height={110} /> : q.error && !q.data ? <ErrorState onRetry={() => q.refetch()} /> : !devices.length ? (
          <EmptyState icon="sensors" title={t('monitor.emptyTitle')} text={t('monitor.emptyText')} action={t('monitor.addDevice')} onAction={() => router.push('/monitor/add')} />
        ) : (
          <>
            <Card style={{ flexDirection: 'row', gap: 8 }}>
              {[[t('monitor.total'), devices.length, colors.text], [t('monitor.online'), online, colors.primary], [t('monitor.alerts'), alerts.length, alerts.length ? colors.error : colors.text], [t('monitor.offline'), offline, offline ? colors.warning : colors.text]].map(([l, v, c]) => (
                <View key={l as string} style={styles.stat}>
                  <AppText variant="headlineMd" color={c as string}>{String(v)}</AppText>
                  <AppText variant="labelSm" color={colors.textSubtle} align="center" numberOfLines={1}>{l as string}</AppText>
                </View>
              ))}
            </Card>

            {alerts.length > 0 && (
              <>
                <SectionHeader title={t('monitor.openAlerts')} action={t('common.seeAll')} onAction={() => router.push('/monitor/alerts')} />
                <Card style={{ gap: 4, paddingVertical: 6 }}>
                  {alerts.slice(0, 4).map((a) => <AlertRow key={a.id} alert={a} device={devices.find((d) => d.id === a.device_id)} onAck={() => ack.mutate({ id: a.id, status: 'acknowledged' })} />)}
                </Card>
              </>
            )}

            {!!equipment.data?.length && (
              <>
                <SectionHeader title={t('monitor.equipment')} action={t('monitor.automation')} onAction={() => router.push('/monitor/automation')} />
                <View style={{ gap: 8 }}>
                  {equipment.data.map((c) => (
                    <Card key={c.id} onPress={() => router.push(`/monitor/device/${c.device_id}`)} style={styles.row} accessibilityLabel={`${c.label ?? c.channel} ${t(`equipment.state.${c.state ?? 'unknown'}`)}`}>
                      <View style={[styles.icon, c.state === 'on' && { backgroundColor: colors.mint }]}><Icon name={c.actuator_type === 'aerator' ? 'air' : c.actuator_type === 'valve' ? 'tune' : c.actuator_type === 'feeder' ? 'set-meal' : 'water-drop'} color={colors.primaryDeep} /></View>
                      <View style={{ flex: 1 }}>
                        <AppText variant="labelLg" numberOfLines={1}>{c.label ?? c.channel}</AppText>
                        <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>{c.device?.name}{c.state_at ? ` · ${ago(c.state_at, t)}` : ''}</AppText>
                      </View>
                      {c.manual_override && <Chip tone="warning" icon="pan-tool" label={t('equipment.manual')} />}
                      <Chip tone={c.state === 'on' ? 'normal' : 'dark'} label={t(`equipment.state.${c.state ?? 'unknown'}`)} />
                    </Card>
                  ))}
                </View>
              </>
            )}

            <SectionHeader title={t('monitor.devices')} action={t('monitor.analytics')} onAction={() => router.push('/monitor/history')} />
            {devices.map((d, i) => {
              const vals = (q.data?.latest ?? []).filter((l) => l.device_id === d.id && l.sensor_type !== 'battery').slice(0, 3);
              const st = status[i];
              return (
                <Card key={d.id} onPress={() => router.push(`/monitor/device/${d.id}`)} accessibilityLabel={`${d.name}, ${t(`monitor.status.${st}`)}`} style={{ gap: 10 }}>
                  <View style={styles.row}>
                    <View style={styles.icon}><Icon name={KIND_ICON[d.kind]} color={colors.primaryDeep} /></View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="labelLg" numberOfLines={1}>{d.name}</AppText>
                      <AppText variant="bodySm" color={colors.textMuted}>{t(`devices.kinds.${d.kind}`)} · {d.last_seen_at ? ago(d.last_seen_at, t) : t('monitor.neverSeen')}</AppText>
                    </View>
                    <Chip tone={st === 'online' ? 'normal' : st === 'offline' ? 'warning' : 'dark'} icon={st === 'online' ? 'wifi' : 'wifi-off'} label={t(`monitor.status.${st}`)} />
                  </View>
                  {(vals.length > 0 || d.is_simulated || d.battery_pct != null) && (
                    <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
                      {d.is_simulated && <SourceBadge source="simulated" />}
                      {vals.map((v) => (
                        <View key={v.sensor_type} style={styles.val}>
                          <AppText variant="labelSm" color={colors.textSubtle}>{t(`sensors.${v.sensor_type}`)}</AppText>
                          <AppText variant="labelLg">{v.value} {SENSOR_UNITS[v.sensor_type]}</AppText>
                        </View>
                      ))}
                      {d.battery_pct != null && <Chip icon={d.battery_pct < 20 ? 'battery-alert' : 'battery-full'} tone={d.battery_pct < 20 ? 'warning' : 'normal'} label={`${Math.round(d.battery_pct)}%`} />}
                    </View>
                  )}
                </Card>
              );
            })}
            <View style={[styles.row, { flexWrap: 'wrap' }]}>
              <Button compact variant="secondary" iconLeft="rule" label={t('monitor.automation')} onPress={() => router.push('/monitor/automation')} />
              <Button compact variant="secondary" iconLeft="notifications" label={t('monitor.alertHistory')} onPress={() => router.push('/monitor/alerts')} />
            </View>
            {devices.some((d) => d.is_simulated) && <Banner message={t('monitor.simulatedNote')} />}
            <SectionHeader title={t('hub.tools')} />
            <HubLinks links={[
              { icon: 'devices', label: 'fleet.devicesTitle', href: '/monitor/devices' }, { icon: 'sensors', label: 'fleet.sensorsTitle', href: '/monitor/sensors' },
              { icon: 'grass', label: 'fleet.soilTitle', href: '/monitor/soil' }, { icon: 'water', label: 'aquaX.analyticsTitle', href: '/aquaculture/water-analytics' },
              { icon: 'tune', label: 'thresholds.set', href: '/monitor/thresholds' }, { icon: 'build', label: 'fleet.calTitle', href: '/monitor/calibration' },
              { icon: 'router', label: 'fleet.networkTitle', href: '/monitor/network' }, { icon: 'settings-remote', label: 'monitor.equipment', href: '/monitor/equipment' },
              { icon: 'water-drop', label: 'fleet.irrControlTitle', href: '/monitor/irrigation-control' }, { icon: 'grid-view', label: 'fleet.zonesTitle', href: '/monitor/zones' },
              { icon: 'dashboard', label: 'command.title', href: '/command-center' }, { icon: 'notifications-active', label: 'alertsCenter.title', href: '/alerts-center' },
            ]} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  val: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: colors.surfaceLow },
});
