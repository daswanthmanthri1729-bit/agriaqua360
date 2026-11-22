// Register a device — design: smart_device_registration_pairing. Real devices get a key shown once; simulated devices
// are clearly labelled, can never control equipment, and start with 24 h of demo history.
import { useState } from 'react';
import { Share, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Checkbox, ChoiceChips, Header, Icon, Screen, SectionHeader, SourceBadge, TextField } from '@/components';
import { KIND_SENSORS, RegisterInput, SENSOR_UNITS, ALL_SENSORS, useRegisterDevice, useSimulate } from '@/features/iot/api';
import { useFarms } from '@/features/agriculture/api';
import { usePonds } from '@/features/aquaculture/api';
import { useAnimals } from '@/features/livestock/api';
import { colors, radius } from '@/theme';
import type { DeviceKind } from '@/types/database';

const KINDS: DeviceKind[] = ['pond_node', 'field_node', 'collar', 'controller', 'gateway'];
const ACT_TYPES = ['pump', 'aerator', 'valve', 'feeder'] as const;
type Act = { type: (typeof ACT_TYPES)[number]; label: string; minutes: string };

export default function AddDevice() {
  const { t } = useTranslation();
  const farms = useFarms(); const ponds = usePonds(); const animals = useAnimals();
  const register = useRegisterDevice();
  const simulate = useSimulate();
  const [simulated, setSimulated] = useState(true);
  const [kind, setKind] = useState<DeviceKind>('pond_node');
  const [name, setName] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [sensors, setSensors] = useState<string[]>(KIND_SENSORS.pond_node);
  const [acts, setActs] = useState<Act[]>([]);
  const [transport, setTransport] = useState<'https' | 'mqtt'>('https');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; secret: string; url: string; topic: string } | null>(null);

  const linkKind = kind === 'pond_node' ? 'pond' : kind === 'collar' ? 'animal' : kind === 'gateway' ? null : 'farm';
  const linkOptions = linkKind === 'pond' ? (ponds.data ?? []).map((p) => ({ value: p.id, label: p.name }))
    : linkKind === 'animal' ? (animals.data ?? []).map((a) => ({ value: a.id, label: a.name || a.tag_id || a.species }))
    : linkKind === 'farm' ? (farms.data ?? []).map((f) => ({ value: f.id, label: f.name })) : [];
  const pickKind = (k: DeviceKind) => { setKind(k); setLink(null); setSensors(KIND_SENSORS[k]); setActs(k === 'controller' && !simulated ? [{ type: 'pump', label: '', minutes: '30' }] : []); };
  const toggle = (s: string) => setSensors((xs) => (xs.includes(s) ? xs.filter((x) => x !== s) : [...xs, s]));

  const submit = async () => {
    setError(null);
    if (!name.trim()) { setError('validation.required'); return; }
    if (acts.some((a) => !(Number(a.minutes) >= 1 && Number(a.minutes) <= 240))) { setError('devices.maxRunInvalid'); return; }
    const count: Record<string, number> = {};
    const input: RegisterInput = {
      name: name.trim(), kind, simulated, transport,
      farm_id: linkKind === 'farm' ? link : null, pond_id: linkKind === 'pond' ? link : null, animal_id: linkKind === 'animal' ? link : null,
      sensors,
      actuators: simulated ? [] : acts.map((a) => { count[a.type] = (count[a.type] ?? 0) + 1; return { channel: `${a.type}${count[a.type]}`, type: a.type, label: a.label.trim() || `${t(`equipment.types.${a.type}`)} ${count[a.type]}`, max_run_s: Math.round(Number(a.minutes) * 60) }; }),
    };
    try {
      const r = await register.mutateAsync(input);
      if (simulated) {
        await simulate.mutateAsync({ id: r.device.id, scenario: 'normal', backfill_hours: 24 }).catch(() => null);
        router.replace(`/monitor/device/${r.device.id}`);
      } else setDone({ id: r.device.id, secret: r.secret!, url: r.ingest_url, topic: r.mqtt_topic });
    } catch (e) { setError(e instanceof Error ? e.message : 'errors.generic'); }
  };

  if (done) return (
    <Screen footer={<Button label={t('devices.savedKey')} iconLeft="check" onPress={() => router.replace(`/monitor/device/${done.id}`)} />}>
      <Header title={t('devices.keyTitle')} hideBack />
      <Banner tone="warning" title={t('devices.keyOnce')} message={t('devices.keyOnceText')} />
      <Card style={{ gap: 12 }}>
        {[[t('devices.deviceId'), done.id], [t('devices.deviceKey'), done.secret], [t('devices.ingestUrl'), done.url], ...(transport === 'mqtt' ? [[t('devices.mqttTopic'), done.topic]] : [])].map(([l, v]) => (
          <View key={l} style={{ gap: 2 }}>
            <AppText variant="labelSm" color={colors.textSubtle}>{l}</AppText>
            <AppText variant="labelLg" selectable style={{ fontFamily: 'monospace' }}>{v}</AppText>
          </View>
        ))}
        <Button variant="secondary" iconLeft="share" label={t('devices.shareKey')}
          onPress={() => Share.share({ message: `DEVICE_ID "${done.id}"\nDEVICE_KEY "${done.secret}"\nINGEST_URL "${done.url}"` })} />
      </Card>
      <AppText variant="bodyMd" color={colors.textMuted}>{t('devices.firmwareHint')}</AppText>
    </Screen>
  );

  return (
    <Screen footer={<Button testID="register" label={simulated ? t('devices.createSimulated') : t('devices.register')} iconLeft="add" loading={register.isPending || simulate.isPending} onPress={submit} />}>
      <Header title={t('monitor.addDevice')} />
      <Card style={{ gap: 10, backgroundColor: simulated ? colors.warningSurface : colors.surface }}>
        <Checkbox checked={simulated} onChange={(v) => { setSimulated(v); if (v) setActs([]); }} label={t('devices.simulatedToggle')}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="labelLg">{t('devices.simulatedToggle')}</AppText>
            <AppText variant="bodySm" color={colors.textMuted}>{t('devices.simulatedHelp')}</AppText>
          </View>
        </Checkbox>
        {simulated && <SourceBadge source="simulated" />}
      </Card>

      <TextField label={t('devices.name')} required value={name} onChangeText={setName} placeholder={t('devices.namePlaceholder')} testID="device-name" />
      <ChoiceChips scroll label={t('devices.kind')} value={kind} onChange={pickKind}
        options={KINDS.filter((k) => !(simulated && k === 'controller')).map((k) => ({ value: k, label: t(`devices.kinds.${k}`) }))} />
      {linkKind && (
        linkOptions.length ? <ChoiceChips scroll label={t(`devices.linkTo.${linkKind}`)} value={link} onChange={setLink} options={linkOptions} />
          : <Banner message={t(`devices.noLink.${linkKind}`)} />
      )}

      {kind !== 'gateway' && (
        <>
          <SectionHeader title={t('devices.sensorsWired')} />
          <AppText variant="bodySm" color={colors.textMuted}>{t('devices.sensorsHelp')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...new Set([...KIND_SENSORS[kind], ...ALL_SENSORS])].filter((s) => KIND_SENSORS[kind].includes(s) || !simulated).map((s) => {
              const on = sensors.includes(s);
              return (
                <View key={s} style={{ borderRadius: radius.full, borderWidth: 1, borderColor: on ? colors.primary : colors.outline, backgroundColor: on ? colors.chip : colors.surface }}>
                  <Button compact variant="text" iconLeft={on ? 'check-box' : 'check-box-outline-blank'} label={`${t(`sensors.${s}`)} (${SENSOR_UNITS[s]})`} onPress={() => toggle(s)} />
                </View>
              );
            })}
          </View>
        </>
      )}

      {kind === 'controller' && !simulated && (
        <>
          <SectionHeader title={t('devices.equipment')} action={acts.length < 4 ? t('devices.addEquipment') : undefined} onAction={() => setActs([...acts, { type: 'aerator', label: '', minutes: '30' }])} />
          <Banner tone="warning" message={t('devices.safety')} />
          {acts.map((a, i) => (
            <Card key={i} style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="power-settings-new" color={colors.primary} />
                <AppText variant="labelLg" style={{ flex: 1 }}>{t('devices.equipmentN', { n: i + 1 })}</AppText>
                <Button compact variant="text" iconLeft="delete-outline" label={t('common.delete')} onPress={() => setActs(acts.filter((_, j) => j !== i))} />
              </View>
              <ChoiceChips value={a.type} onChange={(type) => setActs(acts.map((x, j) => (j === i ? { ...x, type } : x)))} options={ACT_TYPES.map((x) => ({ value: x, label: t(`equipment.types.${x}`) }))} />
              <TextField label={t('devices.equipmentLabel')} value={a.label} onChangeText={(label) => setActs(acts.map((x, j) => (j === i ? { ...x, label } : x)))} />
              <TextField label={t('devices.maxRun')} hint={t('devices.maxRunHint')} keyboardType="number-pad" value={a.minutes} onChangeText={(minutes) => setActs(acts.map((x, j) => (j === i ? { ...x, minutes } : x)))} />
            </Card>
          ))}
        </>
      )}

      {!simulated && <ChoiceChips label={t('devices.transport')} value={transport} onChange={setTransport} options={[{ value: 'https', label: 'HTTPS' }, { value: 'mqtt', label: 'MQTT (EMQX)' }]} />}
      {error && <Banner tone="error" message={t(error)} />}
    </Screen>
  );
}
