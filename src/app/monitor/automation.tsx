// Automation rules — designs: automation_rule_builder_workflow, smart_farm_automation_dashboard.
// Rules start OFF, only real sensor readings can trigger them, the device's max run time and manual switch always win.
import { useEffect, useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, ChoiceChips, EmptyState, ErrorState, Header, LoadingList, Screen, Sheet, TextField } from '@/components';
import { ago } from '@/components/Freshness';
import { SENSOR_UNITS, useDeleteRule, useDevices, useEquipment, useRules, useSaveRule } from '@/features/iot/api';
import { colors } from '@/theme';
import type { AutomationRule } from '@/types/database';

export default function Automation() {
  const { t } = useTranslation();
  const rules = useRules();
  const devices = useDevices();
  const equipment = useEquipment();
  const save = useSaveRule();
  const del = useDeleteRule();
  const [open, setOpen] = useState(false);
  const name = (id: string) => devices.data?.devices.find((d) => d.id === id)?.name ?? '—';
  const eqLabel = (dev: string, ch: string) => equipment.data?.find((c) => c.device_id === dev && c.channel === ch)?.label ?? ch;

  return (
    <Screen footer={<Button label={t('rules.new')} iconLeft="add" onPress={() => setOpen(true)} disabled={!equipment.data?.length} />}>
      <Header title={t('rules.title')} />
      <Banner message={t('rules.safety')} />
      {!equipment.isLoading && !equipment.data?.length && <Banner tone="warning" message={t('rules.needController')} />}
      {rules.isLoading ? <LoadingList /> : rules.error && !rules.data ? <ErrorState onRetry={() => rules.refetch()} /> : !rules.data?.length ? (
        <EmptyState icon="rule" title={t('rules.none')} text={t('rules.noneText')} />
      ) : rules.data.map((r) => (
        <Card key={r.id} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppText variant="labelLg" style={{ flex: 1 }}>{r.name}</AppText>
            <Switch value={r.enabled} accessibilityLabel={t('rules.enabled')} trackColor={{ true: colors.secondary }}
              onValueChange={(enabled) => {
                if (!enabled) return save.mutate({ id: r.id, enabled });
                Alert.alert(t('rules.enableTitle'), t('rules.enableText'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('rules.enable'), onPress: () => save.mutate({ id: r.id, enabled }) }]);
              }} />
          </View>
          <AppText variant="bodyMd">
            {t('rules.sentence', { sensor: t(`sensors.${r.sensor_type}`), device: name(r.sensor_device_id), op: r.operator === '<' ? t('rules.below') : t('rules.above'), value: `${r.threshold} ${SENSOR_UNITS[r.sensor_type]}`,
              action: r.action === 'on' ? t('rules.turnOn', { minutes: Math.round((r.duration_s ?? 0) / 60) }) : t('rules.turnOff'), target: eqLabel(r.target_device_id, r.target_channel) })}
          </AppText>
          <AppText variant="labelSm" color={colors.textSubtle}>{t('rules.cooldown', { minutes: r.cooldown_min })} · {r.last_fired_at ? t('rules.lastFired', { when: ago(r.last_fired_at, t) }) : t('rules.neverFired')}</AppText>
          <Button compact variant="text" iconLeft="delete-outline" label={t('common.delete')} onPress={() => del.mutate(r.id)} />
        </Card>
      ))}
      <RuleSheet visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}

function RuleSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const devices = useDevices();
  const equipment = useEquipment();
  const save = useSaveRule();
  const real = (devices.data?.devices ?? []).filter((d) => !d.is_simulated && d.kind !== 'controller' && d.kind !== 'gateway');
  const [v, setV] = useState<Partial<AutomationRule> & { thr: string; minutes: string }>({ thr: '', minutes: '15' });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setV({ name: '', operator: '<', action: 'on', cooldown_min: 30, thr: '', minutes: '15' }); setError(null); } }, [visible]);
  const sensorTypes = (devices.data?.latest ?? []).filter((l) => l.device_id === v.sensor_device_id).map((l) => l.sensor_type);
  const target = equipment.data?.find((c) => `${c.device_id}|${c.channel}` === `${v.target_device_id}|${v.target_channel}`);

  const submit = async () => {
    const thr = Number(v.thr.replace(',', '.')), minutes = Number(v.minutes);
    if (!v.name?.trim() || !v.sensor_device_id || !v.sensor_type || !v.target_device_id || !Number.isFinite(thr) || v.thr.trim() === '') { setError('rules.incomplete'); return; }
    if (v.action === 'on' && (!(minutes >= 1) || minutes * 60 > (target?.max_run_s ?? 0))) { setError('rules.tooLong'); return; }
    try {
      await save.mutateAsync({ name: v.name.trim(), enabled: false, sensor_device_id: v.sensor_device_id, sensor_type: v.sensor_type, operator: v.operator, threshold: thr,
        target_device_id: v.target_device_id, target_channel: v.target_channel, action: v.action, duration_s: v.action === 'on' ? Math.round(minutes * 60) : null, cooldown_min: v.cooldown_min });
      onClose();
    } catch { setError('errors.generic'); }
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('rules.new')}</AppText>
      <TextField label={t('rules.name')} required value={v.name ?? ''} onChangeText={(name) => setV({ ...v, name })} placeholder={t('rules.namePlaceholder')} />
      {!real.length ? <Banner tone="warning" message={t('rules.needRealSensor')} /> : (
        <ChoiceChips scroll label={t('rules.when')} value={v.sensor_device_id ?? null} onChange={(sensor_device_id) => setV({ ...v, sensor_device_id, sensor_type: undefined })} options={real.map((d) => ({ value: d.id, label: d.name }))} />
      )}
      {!!sensorTypes.length && <ChoiceChips scroll value={v.sensor_type ?? null} onChange={(sensor_type) => setV({ ...v, sensor_type })} options={sensorTypes.map((s) => ({ value: s, label: t(`sensors.${s}`) }))} />}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <ChoiceChips value={v.operator ?? '<'} onChange={(operator) => setV({ ...v, operator })} options={[{ value: '<', label: t('rules.below') }, { value: '>', label: t('rules.above') }]} />
        <View style={{ flex: 1 }}><TextField label={v.sensor_type ? SENSOR_UNITS[v.sensor_type] : t('rules.value')} keyboardType="decimal-pad" value={v.thr} onChangeText={(thr) => setV({ ...v, thr })} /></View>
      </View>
      <ChoiceChips scroll label={t('rules.then')} value={v.target_device_id ? `${v.target_device_id}|${v.target_channel}` : null}
        onChange={(x) => { const [target_device_id, target_channel] = x.split('|'); setV({ ...v, target_device_id, target_channel }); }}
        options={(equipment.data ?? []).map((c) => ({ value: `${c.device_id}|${c.channel}`, label: c.label ?? c.channel }))} />
      <ChoiceChips value={v.action ?? 'on'} onChange={(action) => setV({ ...v, action })} options={[{ value: 'on', label: t('equipment.start') }, { value: 'off', label: t('equipment.stop') }]} />
      {v.action === 'on' && <TextField label={t('rules.minutes')} hint={target ? t('equipment.maxRunShort', { minutes: Math.round((target.max_run_s ?? 0) / 60) }) : undefined} keyboardType="number-pad" value={v.minutes} onChangeText={(minutes) => setV({ ...v, minutes })} />}
      <ChoiceChips label={t('rules.cooldownLabel')} value={String(v.cooldown_min ?? 30)} onChange={(c) => setV({ ...v, cooldown_min: Number(c) })} options={[15, 30, 60, 180].map((m) => ({ value: String(m), label: t('equipment.minutes', { count: m }) }))} />
      <Banner message={t('rules.startsOff')} />
      {error && <Banner tone="error" message={t(error)} />}
      <Button label={t('common.save')} iconLeft="check" loading={save.isPending} onPress={submit} />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}
