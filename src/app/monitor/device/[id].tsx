// Device detail — designs: advanced_device_configuration_diagnostics, sensor_calibration_maintenance_diagnostics,
// advanced_sensor_threshold_alert_configuration, automated_irrigation_control_center (equipment controls).
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AppText, Banner, Button, Card, Chip, ChoiceChips, ErrorState, Freshness, Header, Icon, LineChart, LoadingList, Screen, SectionHeader, Sheet, SourceBadge, TextField,
} from '@/components';
import { ago } from '@/components/Freshness';
import {
  deviceStatus, SENSOR_UNITS, useCancelCommand, useCommands, useDeleteDevice, useDevice, useRealtime, useRotateKey, useSendCommand, useSeries, useSetThreshold, useSimulate, useUpdateChannel, useUpdateDevice,
} from '@/features/iot/api';
import { axisFormat } from '@/lib/dates';
import { colors, radius } from '@/theme';
import type { DeviceChannel, Threshold } from '@/types/database';

const RANGES = [{ h: 24, k: '24h' }, { h: 168, k: '7d' }, { h: 720, k: '30d' }];
const SCENARIOS = ['normal', 'low_oxygen', 'dry_soil', 'fever', 'sensor_fault'] as const;
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export default function DeviceDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useDevice(id);
  useRealtime('sensor_readings', `device_id=eq.${id}`, [['device', id], ['series']]);
  useRealtime('device_channels', `device_id=eq.${id}`, [['device', id]]);
  useRealtime('actuator_commands', `device_id=eq.${id}`, [['commands', id]]);
  const commands = useCommands(id);
  const [sel, setSel] = useState<string | null>(null);
  const [hours, setHours] = useState(24);
  const [thSheet, setThSheet] = useState<string | null>(null);
  const [calSheet, setCalSheet] = useState<DeviceChannel | null>(null);
  const [scenario, setScenario] = useState<(typeof SCENARIOS)[number]>('normal');
  const simulate = useSimulate();
  const send = useSendCommand();
  const cancel = useCancelCommand();
  const rotate = useRotateKey();
  const del = useDeleteDevice();
  const update = useUpdateDevice();

  const sensors = (q.data?.channels ?? []).filter((c) => c.kind === 'sensor' && c.sensor_type);
  const actuators = (q.data?.channels ?? []).filter((c) => c.kind === 'actuator');
  const selected = sel ?? sensors.find((c) => c.sensor_type !== 'battery')?.sensor_type ?? sensors[0]?.sensor_type ?? null;
  const series = useSeries(selected ? { sensorType: selected, hours, deviceId: id } : null);
  const th = (type: string) => q.data?.thresholds.find((x) => x.sensor_type === type);
  const chartPts = useMemo(() => (series.data ?? []).map((p) => ({ x: Date.parse(p.bucket), y: Number(p.avg_value), lo: Number(p.min_value), hi: Number(p.max_value) })), [series.data]);

  if (q.isLoading) return <Screen><Header /><LoadingList height={120} /></Screen>;
  if (!q.data) return <Screen><Header /><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const d = q.data.device;
  const st = deviceStatus(d);
  const unit = selected ? SENSOR_UNITS[selected] : '';
  const limit = selected ? th(selected) : undefined;

  const run = (c: DeviceChannel, minutes: number | null) => {
    const label = c.label ?? c.channel;
    Alert.alert(minutes ? t('equipment.confirmOn', { name: label, minutes }) : t('equipment.confirmOff', { name: label }), t('equipment.confirmText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: minutes ? t('equipment.start') : t('equipment.stop'), style: minutes ? 'default' : 'destructive', onPress: () =>
        send.mutate({ device_id: d.id, channel: c.channel, action: minutes ? 'on' : 'off', duration_s: minutes ? minutes * 60 : null }, { onError: () => Alert.alert(t('errors.generic')) }) },
    ]);
  };
  const confirmDelete = () => Alert.alert(t('devices.deleteTitle'), t('devices.deleteText'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: async () => { try { await del.mutateAsync(d.id); router.back(); } catch { Alert.alert(t('errors.generic')); } } },
  ]);
  const rotateKey = () => Alert.alert(t('devices.rotateTitle'), t('devices.rotateText'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('devices.rotate'), onPress: async () => {
      try { const r = await rotate.mutateAsync(d.id); Alert.alert(t('devices.newKey'), r.secret); } catch { Alert.alert(t('errors.generic')); }
    } },
  ]);

  return (
    <Screen>
      <Header title={d.name} />
      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        <Chip tone={st === 'online' ? 'normal' : st === 'offline' ? 'warning' : 'dark'} icon={st === 'online' ? 'wifi' : 'wifi-off'} label={t(`monitor.status.${st}`)} />
        {d.is_simulated && <SourceBadge source="simulated" />}
        <Chip icon="memory" label={t(`devices.kinds.${d.kind}`)} />
        {d.battery_pct != null && <Chip icon="battery-full" tone={d.battery_pct < 20 ? 'warning' : 'normal'} label={`${Math.round(d.battery_pct)}%`} />}
        {d.rssi_dbm != null && <Chip icon="network-wifi" label={`${d.rssi_dbm} dBm`} />}
      </View>
      <Freshness at={d.last_seen_at} staleAfterMin={Math.max(15, (d.reporting_interval_s * 3) / 60)} source={d.firmware ?? undefined} />

      {d.is_simulated && (
        <Card style={{ gap: 10, backgroundColor: colors.warningSurface }}>
          <AppText variant="labelLg">{t('simulator.title')}</AppText>
          <AppText variant="bodySm" color={colors.textMuted}>{t('simulator.help')}</AppText>
          <ChoiceChips scroll value={scenario} onChange={setScenario} options={SCENARIOS.map((s) => ({ value: s, label: t(`simulator.scenarios.${s}`) }))} />
          <Button iconLeft="play-arrow" label={t('simulator.send')} loading={simulate.isPending} testID="simulate"
            onPress={() => simulate.mutate({ id: d.id, scenario }, { onError: (e) => Alert.alert(t(e instanceof Error ? e.message : 'errors.generic')) })} />
        </Card>
      )}

      {sensors.length > 0 && (
        <>
          <SectionHeader title={t('devices.live')} />
          <View style={styles.grid}>
            {sensors.map((c) => {
              const v = q.data.latest.find((l) => l.sensor_type === c.sensor_type);
              const lim = th(c.sensor_type!);
              const bad = v && lim && ((lim.min_value != null && v.value < lim.min_value) || (lim.max_value != null && v.value > lim.max_value));
              const active = c.sensor_type === selected;
              return (
                <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${t(`sensors.${c.sensor_type}`)} ${v?.value ?? '—'} ${SENSOR_UNITS[c.sensor_type!]}`}
                  onPress={() => setSel(c.sensor_type)} style={[styles.tile, active && { borderColor: colors.primary, borderWidth: 2 }, bad && { backgroundColor: colors.errorSurface }]}>
                  <AppText variant="labelSm" color={colors.textSubtle} numberOfLines={1}>{t(`sensors.${c.sensor_type}`)}</AppText>
                  <AppText variant="headlineSm" color={bad ? colors.error : colors.text}>{v ? v.value : '—'} <AppText variant="labelMd" color={colors.textMuted}>{SENSOR_UNITS[c.sensor_type!]}</AppText></AppText>
                  <AppText variant="labelSm" color={colors.textSubtle}>{v ? ago(v.recorded_at, t) : t('devices.noData')}{!c.enabled ? ` · ${t('devices.disabled')}` : ''}</AppText>
                </Pressable>
              );
            })}
          </View>

          {selected && (
            <Card style={{ gap: 10 }}>
              <View style={styles.row}>
                <AppText variant="labelLg" style={{ flex: 1 }}>{t(`sensors.${selected}`)} ({unit})</AppText>
                <Button compact variant="text" iconLeft="open-in-full" label={t('devices.fullHistory')} onPress={() => router.push({ pathname: '/monitor/history', params: { device: d.id, sensor: selected } })} />
              </View>
              <ChoiceChips value={String(hours)} onChange={(v) => setHours(Number(v))} options={RANGES.map((r) => ({ value: String(r.h), label: t(`range.${r.k}`) }))} />
              {series.isLoading ? <LoadingList count={1} height={180} /> : chartPts.length ? (
                <LineChart series={[{ points: chartPts, label: t(`sensors.${selected}`) }]} unit={unit} formatX={axisFormat(hours, i18n.language)}
                  limits={[limit?.min_value != null && { y: Number(limit.min_value), label: t('thresholds.min') }, limit?.max_value != null && { y: Number(limit.max_value), label: t('thresholds.max') }].filter(Boolean) as { y: number; label: string }[]} />
              ) : <AppText variant="bodyMd" color={colors.textMuted}>{t('devices.noHistory')}</AppText>}
              {d.is_simulated && chartPts.length > 0 && <AppText variant="labelSm" color={colors.warning}>{t('devices.chartSimulated')}</AppText>}
              <View style={[styles.row, { flexWrap: 'wrap' }]}>
                <Button compact variant="secondary" iconLeft="notifications-active" label={t('thresholds.set')} onPress={() => setThSheet(selected)} />
                <Button compact variant="secondary" iconLeft="tune" label={t('calibration.title')} onPress={() => setCalSheet(sensors.find((c) => c.sensor_type === selected) ?? null)} />
              </View>
            </Card>
          )}
        </>
      )}

      {actuators.length > 0 && (
        <>
          <SectionHeader title={t('devices.equipment')} />
          {st !== 'online' && <Banner tone="warning" message={t('equipment.deviceOffline')} />}
          {actuators.map((c) => {
            const pending = (commands.data ?? []).find((x) => x.channel === c.channel && (x.status === 'pending' || x.status === 'sent'));
            const options = [5, 15, 30, 60].filter((m) => m * 60 <= (c.max_run_s ?? 0));
            return (
              <Card key={c.id} style={{ gap: 10 }}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: c.state === 'on' ? colors.secondary : colors.outline }]} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="labelLg">{c.label ?? c.channel}</AppText>
                    <AppText variant="bodySm" color={colors.textMuted}>{t(`equipment.state.${c.state ?? 'unknown'}`)}{c.state_at ? ` · ${ago(c.state_at, t)}` : ''} · {t('equipment.maxRunShort', { minutes: Math.round((c.max_run_s ?? 0) / 60) })}</AppText>
                  </View>
                  {c.manual_override && <Chip tone="warning" icon="pan-tool" label={t('equipment.manual')} />}
                </View>
                {c.manual_override ? <Banner tone="warning" message={t('equipment.manualText')} /> : pending ? (
                  <View style={styles.row}>
                    <Icon name="hourglass-top" color={colors.warning} />
                    <AppText variant="bodyMd" style={{ flex: 1 }}>{t(`equipment.cmdStatus.${pending.status}`, { action: t(`equipment.${pending.action === 'on' ? 'start' : 'stop'}`) })}</AppText>
                    {pending.status === 'pending' && <Button compact variant="text" label={t('common.cancel')} onPress={() => cancel.mutate(pending.id)} />}
                  </View>
                ) : (
                  <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    {options.map((m) => <Button key={m} compact variant="secondary" iconLeft="play-arrow" label={t('equipment.minutes', { count: m })} onPress={() => run(c, m)} />)}
                    <Button compact variant="text" iconLeft="stop" label={t('equipment.stop')} onPress={() => run(c, null)} />
                  </View>
                )}
              </Card>
            );
          })}
          {!!commands.data?.length && (
            <Card style={{ gap: 6 }}>
              <AppText variant="labelLg">{t('equipment.log')}</AppText>
              {commands.data.slice(0, 8).map((x) => (
                <AppText key={x.id} variant="bodySm" color={colors.textMuted}>
                  {ago(x.created_at, t)} · {x.channel} · {t(`equipment.${x.action === 'on' ? 'start' : 'stop'}`)}{x.duration_s ? ` ${Math.round(x.duration_s / 60)} min` : ''} · {x.requested_by === 'rule' ? t('equipment.byRule') : t('equipment.byYou')} · {t(`equipment.status.${x.status}`)}
                </AppText>
              ))}
            </Card>
          )}
        </>
      )}

      <SectionHeader title={t('devices.settings')} />
      <Card style={{ gap: 10 }}>
        <ChoiceChips label={t('devices.interval')} value={String(d.reporting_interval_s)} onChange={(v) => update.mutate({ id: d.id, patch: { reporting_interval_s: Number(v) } })}
          options={[60, 300, 900, 1800, 3600].map((s) => ({ value: String(s), label: s < 3600 ? t('equipment.minutes', { count: s / 60 }) : t('time.hours', { count: 1 }) }))} />
        {!d.is_simulated && <Button variant="secondary" iconLeft="key" label={t('devices.rotate')} loading={rotate.isPending} onPress={rotateKey} />}
        <Button variant="secondary" iconLeft="menu-book" label={t('devices.setupGuide')} onPress={() => router.push('/help')} />
        <Button variant="text" iconLeft="delete-outline" label={t('devices.delete')} loading={del.isPending} onPress={confirmDelete} />
      </Card>

      <ThresholdSheet deviceId={d.id} sensorType={thSheet} existing={thSheet ? th(thSheet) : undefined} onClose={() => setThSheet(null)} />
      <CalibrationSheet channel={calSheet} current={calSheet ? q.data.latest.find((l) => l.sensor_type === calSheet.sensor_type)?.value : undefined} onClose={() => setCalSheet(null)} />
    </Screen>
  );
}

function ThresholdSheet({ deviceId, sensorType, existing, onClose }: { deviceId: string; sensorType: string | null; existing?: Threshold; onClose: () => void }) {
  const { t } = useTranslation();
  const set = useSetThreshold();
  const [min, setMin] = useState(''); const [max, setMax] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setMin(existing?.min_value != null ? String(existing.min_value) : ''); setMax(existing?.max_value != null ? String(existing.max_value) : ''); setError(null); }, [sensorType, existing]);
  const save = async () => {
    const lo = num(min), hi = num(max);
    if ((lo != null && Number.isNaN(lo)) || (hi != null && Number.isNaN(hi)) || (lo != null && hi != null && lo >= hi)) { setError('thresholds.invalid'); return; }
    try { await set.mutateAsync({ deviceId, sensorType: sensorType!, min: lo, max: hi, existing }); onClose(); } catch { setError('errors.generic'); }
  };
  return (
    <Sheet visible={!!sensorType} onClose={onClose}>
      <AppText variant="headlineMd">{t('thresholds.title', { param: sensorType ? t(`sensors.${sensorType}`) : '' })}</AppText>
      <AppText variant="bodySm" color={colors.textMuted}>{t('thresholds.help')}</AppText>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><TextField label={`${t('thresholds.min')} (${sensorType ? SENSOR_UNITS[sensorType] : ''})`} keyboardType="decimal-pad" value={min} onChangeText={setMin} /></View>
        <View style={{ flex: 1 }}><TextField label={`${t('thresholds.max')} (${sensorType ? SENSOR_UNITS[sensorType] : ''})`} keyboardType="decimal-pad" value={max} onChangeText={setMax} /></View>
      </View>
      {error && <Banner tone="error" message={t(error)} />}
      <Button label={t('common.save')} iconLeft="check" loading={set.isPending} onPress={save} />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}

// One-point calibration: "the reference meter says X" → offset; or enter offset/scale directly.
function CalibrationSheet({ channel, current, onClose }: { channel: DeviceChannel | null; current?: number; onClose: () => void }) {
  const { t } = useTranslation();
  const upd = useUpdateChannel();
  const [offset, setOffset] = useState(''); const [scale, setScale] = useState(''); const [truth, setTruth] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (channel) { setOffset(String(channel.calibration_offset)); setScale(String(channel.calibration_scale)); setTruth(''); setError(null); } }, [channel]);
  if (!channel) return null;
  const fromReference = () => {
    const r = num(truth);
    if (r == null || Number.isNaN(r) || current == null) return;
    setOffset(String(Math.round((Number(offset || 0) + (r - current)) * 1000) / 1000));
  };
  const save = async () => {
    const o = num(offset), s = num(scale);
    if (o == null || s == null || Number.isNaN(o) || Number.isNaN(s) || s <= 0) { setError('calibration.invalid'); return; }
    try { await upd.mutateAsync({ id: channel.id, patch: { calibration_offset: o, calibration_scale: s, calibrated_at: new Date().toISOString() } }); onClose(); } catch { setError('errors.generic'); }
  };
  return (
    <Sheet visible onClose={onClose}>
      <AppText variant="headlineMd">{t('calibration.title')} · {t(`sensors.${channel.sensor_type}`)}</AppText>
      <AppText variant="bodySm" color={colors.textMuted}>{t('calibration.help')}</AppText>
      {current != null && (
        <Card style={{ gap: 8 }}>
          <AppText variant="labelLg">{t('calibration.reference', { value: current, unit: SENSOR_UNITS[channel.sensor_type!] })}</AppText>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}><TextField label={t('calibration.meterSays')} keyboardType="decimal-pad" value={truth} onChangeText={setTruth} /></View>
            <Button compact variant="secondary" label={t('calibration.apply')} onPress={fromReference} />
          </View>
        </Card>
      )}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><TextField label={t('calibration.offset')} keyboardType="numbers-and-punctuation" value={offset} onChangeText={setOffset} /></View>
        <View style={{ flex: 1 }}><TextField label={t('calibration.scale')} keyboardType="decimal-pad" value={scale} onChangeText={setScale} /></View>
      </View>
      {channel.calibrated_at && <AppText variant="labelSm" color={colors.textSubtle}>{t('calibration.last', { when: ago(channel.calibrated_at, t) })}</AppText>}
      {error && <Banner tone="error" message={t(error)} />}
      <Button label={t('common.save')} iconLeft="check" loading={upd.isPending} onPress={save} />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexGrow: 1, flexBasis: '45%', padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 2 },
  dot: { width: 14, height: 14, borderRadius: 7 },
});
