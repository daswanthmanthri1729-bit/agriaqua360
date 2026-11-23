// Irrigation control centre — design: automated_irrigation_control_center. Today's advice next to the pumps and valves.
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Chip, EmptyState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { useCrops, useFarms } from '@/features/agriculture/api';
import { irrigationAdvice } from '@/features/intel/agronomy';
import { farmPoint } from '@/features/intel/place';
import { useCommands, useEquipment, useLatestFor, useRealtime } from '@/features/iot/api';
import { EquipmentCard } from '@/features/iot/EquipmentCard';
import { useWeather } from '@/features/weather/api';
import { useSession } from '@/store/session';

export default function IrrigationControl() {
  const { t } = useTranslation();
  const profile = useSession((s) => s.profile);
  const eq = useEquipment(); const cmds = useCommands();
  const crops = useCrops(); const farms = useFarms();
  useRealtime('device_channels', null, [['equipment']]);
  const crop = (crops.data ?? []).find((c) => c.status === 'growing');
  const farm = farms.data?.find((f) => f.id === crop?.farm_id);
  const pt = farmPoint(farm, profile);
  const w = useWeather(pt ? { lat: pt.lat, lon: pt.lon } : null);
  const moisture = useLatestFor({ farmId: farm?.id }).data?.find((v) => v.sensor_type === 'soil_moisture');
  const water = (eq.data ?? []).filter((c) => c.actuator_type === 'pump' || c.actuator_type === 'valve');
  const days = w.data?.daily ?? [];
  const advice = crop && days.some((d) => d.et0_mm != null) ? irrigationAdvice({ crop: crop.name, stage: crop.growth_stage, et0: days.map((d) => d.et0_mm ?? 0), rain: days.map((d) => d.rain_mm), areaAcres: crop.area_acres, soilMoisturePct: moisture?.value }) : null;
  if (eq.isLoading) return <Screen><Header title={t('fleet.irrControlTitle')} /><LoadingList /></Screen>;
  return (
    <Screen>
      <Header title={t('fleet.irrControlTitle')} />
      {advice ? (
        <Banner tone={advice.decision === 'irrigate_today' ? 'warning' : 'info'} title={`${crop!.name}: ${t(`irrigation.decision.${advice.decision}`)}`}
          message={`${t('irrigation.need')}: ${advice.need_mm} mm${advice.litres != null ? ` (${advice.litres.toLocaleString('en-IN')} L)` : ''} · ${t('irrigation.rain')}: ${advice.rain_mm} mm`} />
      ) : <Banner message={t('fleet.noAdvice')} />}
      {moisture && <Chip icon="water-drop" label={`${t('sensors.soil_moisture')} ${moisture.value}%`} />}
      <Button variant="secondary" iconLeft="water-drop" label={t('irrigation.title')} onPress={() => router.push('/agriculture/irrigation')} />
      <SectionHeader title={t('fleet.pumpsValves')} />
      {water.length ? water.map((c) => <EquipmentCard key={c.id} channel={c} commands={cmds.data ?? []} subtitle={c.device?.name} />)
        : <EmptyState icon="settings-remote" title={t('rules.needController')} text={t('fleet.controllerText')} action={t('monitor.addDevice')} onAction={() => router.push('/monitor/add')} />}
      <Button variant="text" iconLeft="rule" label={t('monitor.automation')} onPress={() => router.push('/monitor/automation')} />
    </Screen>
  );
}
