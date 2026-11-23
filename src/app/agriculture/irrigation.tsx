// Irrigation intelligence — designs: smart_irrigation_dashboard, ai_water_management_irrigation_predictions,
// advanced_rainfall_irrigation_weather_analytics. FAO-56 estimate from forecast ET0 + rain (+ soil sensor when present).
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Button, Card, Chip, ChoiceChips, EmptyState, Freshness, Header, LoadingList, Screen, SectionHeader, SourceBadge, TextField } from '@/components';
import { useCrops, useFarms, useRecords, useUpdateCrop } from '@/features/agriculture/api';
import { irrigationAdvice } from '@/features/intel/agronomy';
import { useLogIrrigation } from '@/features/intel/api';
import { farmPoint } from '@/features/intel/place';
import { useEquipment, useLatestFor } from '@/features/iot/api';
import { useWeather } from '@/features/weather/api';
import { useSession } from '@/store/session';
import { addDays, formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';
import type { GrowthStage } from '@/types/database';

const STAGES: GrowthStage[] = ['germination', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest'];
const DECISION = { irrigate_today: { tone: 'error', icon: 'water-drop' }, irrigate_soon: { tone: 'warning', icon: 'schedule' }, wait_rain: { tone: 'normal', icon: 'umbrella' }, not_needed: { tone: 'normal', icon: 'check-circle' } } as const;

export default function Irrigation() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ crop?: string }>();
  const profile = useSession((s) => s.profile);
  const crops = useCrops(); const farms = useFarms();
  const growing = (crops.data ?? []).filter((c) => c.status === 'growing');
  const [cropId, setCropId] = useState<string | null>(params.crop ?? null);
  const crop = growing.find((c) => c.id === cropId) ?? growing[0];
  const farm = farms.data?.find((f) => f.id === crop?.farm_id);
  const pt = farmPoint(farm, profile);
  const weather = useWeather(pt ? { lat: pt.lat, lon: pt.lon, name: farm?.village ?? undefined } : null);
  const live = useLatestFor({ farmId: farm?.id });
  const moisture = live.data?.find((v) => v.sensor_type === 'soil_moisture');
  const equipment = useEquipment();
  const updateCrop = useUpdateCrop();
  const log = useLogIrrigation();
  const [litres, setLitres] = useState('');
  const records = useRecords({ cropId: crop?.id, from: addDays(today(), -30) });
  const water = useMemo(() => (records.data ?? []).filter((r) => r.activity === 'irrigation' && r.completed_at), [records.data]);

  if (crops.isLoading) return <Screen><Header title={t('irrigation.title')} /><LoadingList /></Screen>;
  if (!growing.length) return <Screen><Header title={t('irrigation.title')} /><EmptyState icon="eco" title={t('irrigation.noCrop')} action={t('dashboard.addCrop')} onAction={() => router.push('/agriculture/crops/new')} /></Screen>;

  const days = weather.data?.daily ?? [];
  const hasEt0 = days.some((d) => d.et0_mm != null);
  const advice = hasEt0 ? irrigationAdvice({ crop: crop!.name, stage: crop!.growth_stage, et0: days.map((d) => d.et0_mm ?? 0), rain: days.map((d) => d.rain_mm), areaAcres: crop!.area_acres, soilMoisturePct: moisture?.value }) : null;
  const look = advice ? DECISION[advice.decision] : null;

  return (
    <Screen>
      <Header title={t('irrigation.title')} />
      {growing.length > 1 && <ChoiceChips scroll value={crop!.id} onChange={setCropId} options={growing.map((c) => ({ value: c.id, label: c.name }))} />}
      <ChoiceChips scroll label={t('irrigation.stage')} value={crop!.growth_stage ?? null} onChange={(growth_stage) => updateCrop.mutate({ id: crop!.id, patch: { growth_stage } })}
        options={STAGES.map((s) => ({ value: s, label: t(`stage.${s}`) }))} />
      {!crop!.growth_stage && <Banner message={t('irrigation.pickStage')} />}

      {!pt ? <Banner tone="warning" message={t('irrigation.noLocation')} /> : weather.isLoading ? <LoadingList count={1} height={160} /> : !advice ? (
        <Banner tone="warning" message={t('irrigation.noEt0')} />
      ) : (
        <Card style={{ gap: 10 }}>
          <Chip tone={look!.tone} icon={look!.icon} label={t(`irrigation.decision.${advice.decision}`)} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[[t('irrigation.need'), `${advice.need_mm} mm`], [t('irrigation.litres'), advice.litres != null ? `${advice.litres.toLocaleString('en-IN')} L` : '—'], [t('irrigation.rain'), `${advice.rain_mm} mm`]].map(([l, v]) => (
              <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                <AppText variant="labelSm" color={colors.textSubtle}>{l}</AppText>
                <AppText variant="headlineSm">{v}</AppText>
              </View>
            ))}
          </View>
          {advice.reasons.map((r) => <AppText key={r} variant="bodyMd">• {t(r, { value: moisture?.value })}</AppText>)}
          <AppText variant="labelSm" color={colors.textSubtle}>{t('irrigation.method', { kc: advice.kc, etc: advice.etc_mm, days: advice.days })}</AppText>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <SourceBadge source="api" label="Open-Meteo ET0" />
            {moisture && <SourceBadge source={moisture.source} label={`${t('sensors.soil_moisture')} ${moisture.value}%`} />}
            {!moisture && weather.data?.soil_moisture_estimate && <SourceBadge source="model" label={t('irrigation.modelMoisture', { value: weather.data.soil_moisture_estimate.cm_3_9_pct ?? weather.data.soil_moisture_estimate.top_1cm_pct })} />}
          </View>
          <Freshness at={weather.data?.fetched_at ?? weather.data?.observed_at} staleAfterMin={120} />
        </Card>
      )}

      {days.length > 0 && (
        <>
          <SectionHeader title={t('irrigation.forecast')} />
          <Card style={{ gap: 6 }}>
            <BarChart bars={days.map((d) => ({ label: formatDate(d.date, i18n.language, { weekday: 'short' }), value: d.rain_mm, color: colors.water }))} unit="mm" height={130} formatY={(y) => `${Math.round(y)}`} />
            <AppText variant="labelSm" color={colors.textSubtle}>{t('irrigation.rainBars')}{hasEt0 ? ` · ET0 ${days.slice(0, 3).map((d) => d.et0_mm).join(' / ')} mm` : ''}</AppText>
          </Card>
        </>
      )}

      {!!equipment.data?.length && (
        <Button variant="secondary" iconLeft="settings-remote" label={t('irrigation.controlPump')} onPress={() => router.push(`/monitor/device/${equipment.data![0].device_id}`)} />
      )}

      <SectionHeader title={t('irrigation.log')} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}><TextField label={t('irrigation.litresUsed')} keyboardType="number-pad" value={litres} onChangeText={setLitres} placeholder={advice?.litres ? String(advice.litres) : ''} /></View>
          <Button compact iconLeft="add" label={t('irrigation.logNow')} loading={log.isPending}
            onPress={() => log.mutateAsync({ crop_id: crop!.id, date: today(), litres: Number(litres) > 0 ? Number(litres) : null }).then(() => setLitres(''), () => Alert.alert(t('errors.generic')))} />
        </View>
        {water.length ? (
          <>
            <BarChart bars={water.slice(-14).map((r) => ({ label: formatDate(r.scheduled_for!, i18n.language, { day: 'numeric', month: 'short' }), value: Number(r.quantity ?? 0) }))} unit="L" height={120}
              formatY={(y) => (y >= 1000 ? `${Math.round(y / 1000)}k` : `${Math.round(y)}`)} />
            <AppText variant="labelSm" color={colors.textSubtle}>{t('irrigation.total30', { litres: water.reduce((s, r) => s + Number(r.quantity ?? 0), 0).toLocaleString('en-IN'), count: water.length })}</AppText>
          </>
        ) : <AppText variant="bodySm" color={colors.textMuted}>{t('irrigation.noLog')}</AppText>}
      </Card>
    </Screen>
  );
}
