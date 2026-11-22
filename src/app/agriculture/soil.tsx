// Soil health — designs: soil_health_dashboard, ai_soil_intelligence, soil_testing_lab_analysis, live_soil_sensors.
// Three clearly separated sources: lab test (measured), live sensors (measured now), SoilGrids (modelled estimate).
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, DateField, EmptyState, Freshness, Header, LoadingList, Screen, SectionHeader, Sheet, SourceBadge, TextField } from '@/components';
import { useFarms } from '@/features/agriculture/api';
import { useAddSoilTest, useDeleteSoilTest, useSoilEstimate, useSoilTests } from '@/features/intel/api';
import { rateEc, rateNutrient, ratePh } from '@/features/intel/agronomy';
import { InsightCard } from '@/features/intel/InsightCard';
import { SENSOR_UNITS, useLatestFor } from '@/features/iot/api';
import { ago } from '@/components/Freshness';
import { farmPoint } from '@/features/intel/place';
import { useSession } from '@/store/session';
import { formatDate, today } from '@/lib/dates';
import { colors, radius } from '@/theme';
import type { SoilTest } from '@/types/database';

const TONE = { low: colors.warning, medium: colors.primary, high: colors.secondary, acidic: colors.warning, alkaline: colors.warning, neutral: colors.primary, normal: colors.primary, caution: colors.warning, harmful: colors.error } as Record<string, string>;

export default function Soil() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ farm?: string }>();
  const farms = useFarms();
  const profile = useSession((s) => s.profile);
  const [farmId, setFarmId] = useState<string | null>(params.farm ?? null);
  const farm = farms.data?.find((f) => f.id === (farmId ?? farms.data?.[0]?.id));
  const tests = useSoilTests(farm?.id ?? null);
  const live = useLatestFor({ farmId: farm?.id });
  const pt = farmPoint(farm, profile);
  const est = useSoilEstimate(pt?.lat, pt?.lon);
  const del = useDeleteSoilTest();
  const [open, setOpen] = useState(false);
  const latest = tests.data?.[0];
  const soilLive = (live.data ?? []).filter((v) => v.sensor_type.startsWith('soil'));
  const top = (p: string) => est.data?.layers.find((l) => l.property === p)?.depths.find((d) => d.depth === '0-5cm')?.value ?? null;

  if (farms.isLoading) return <Screen><Header title={t('soil.title')} /><LoadingList /></Screen>;
  if (!farms.data?.length) return <Screen><Header title={t('soil.title')} /><EmptyState icon="add-location-alt" title={t('soil.noFarm')} action={t('dashboard.addFarm')} onAction={() => router.push('/agriculture/farms/new')} /></Screen>;

  const tile = (label: string, value: string, rating: string | null) => (
    <View key={label} style={{ flexGrow: 1, flexBasis: '30%', padding: 10, borderRadius: radius.md, backgroundColor: colors.surfaceLow, gap: 2 }}>
      <AppText variant="labelSm" color={colors.textSubtle}>{label}</AppText>
      <AppText variant="labelLg">{value}</AppText>
      {rating && <AppText variant="labelSm" color={TONE[rating]}>{t(`soil.rating.${rating}`)}</AppText>}
    </View>
  );

  return (
    <Screen footer={<Button label={t('soil.addTest')} iconLeft="biotech" onPress={() => setOpen(true)} />}>
      <Header title={t('soil.title')} />
      {farms.data.length > 1 && <ChoiceChips scroll value={farm?.id ?? null} onChange={setFarmId} options={farms.data.map((f) => ({ value: f.id, label: f.name }))} />}

      <SectionHeader title={t('soil.labTitle')} />
      {tests.isLoading ? <LoadingList count={1} /> : latest ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <SourceBadge source="lab" label={t(`soil.src.${latest.source}`)} />
            <AppText variant="labelMd" color={colors.textMuted}>{formatDate(latest.tested_on, i18n.language)}{latest.lab_name ? ` · ${latest.lab_name}` : ''}</AppText>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {latest.ph != null && tile('pH', String(latest.ph), ratePh(latest.ph))}
            {latest.ec_dsm != null && tile('EC (dS/m)', String(latest.ec_dsm), rateEc(latest.ec_dsm))}
            {latest.organic_carbon_pct != null && tile(t('soil.oc'), `${latest.organic_carbon_pct}%`, rateNutrient('oc', latest.organic_carbon_pct))}
            {latest.nitrogen_kg_ha != null && tile(t('soil.n'), `${latest.nitrogen_kg_ha} kg/ha`, rateNutrient('n', latest.nitrogen_kg_ha))}
            {latest.phosphorus_kg_ha != null && tile(t('soil.p'), `${latest.phosphorus_kg_ha} kg/ha`, rateNutrient('p', latest.phosphorus_kg_ha))}
            {latest.potassium_kg_ha != null && tile(t('soil.k'), `${latest.potassium_kg_ha} kg/ha`, rateNutrient('k', latest.potassium_kg_ha))}
            {latest.sulphur_ppm != null && tile(t('soil.s'), `${latest.sulphur_ppm} ppm`, null)}
            {latest.zinc_ppm != null && tile(t('soil.zn'), `${latest.zinc_ppm} ppm`, null)}
          </View>
          {(tests.data?.length ?? 0) > 1 && <AppText variant="labelSm" color={colors.textSubtle}>{t('soil.olderTests', { count: tests.data!.length - 1 })}</AppText>}
          <Button compact variant="text" iconLeft="delete-outline" label={t('common.delete')}
            onPress={() => Alert.alert(t('soil.deleteTitle'), '', [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: () => del.mutate(latest.id) }])} />
        </Card>
      ) : <Banner title={t('soil.noTestTitle')} message={t('soil.noTest')} />}

      <SectionHeader title={t('soil.liveTitle')} action={soilLive.length ? t('devices.fullHistory') : t('monitor.addDevice')}
        onAction={() => (soilLive.length ? router.push({ pathname: '/monitor/history', params: { device: soilLive[0].device_id, sensor: soilLive[0].sensor_type } }) : router.push('/monitor/add'))} />
      {soilLive.length ? (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {soilLive.map((v) => tile(t(`sensors.${v.sensor_type}`), `${v.value} ${SENSOR_UNITS[v.sensor_type]}`, null))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <SourceBadge source={soilLive[0].source} />
            <AppText variant="labelSm" color={colors.textSubtle}>{ago(soilLive[0].recorded_at, t)}</AppText>
          </View>
        </Card>
      ) : <AppText variant="bodyMd" color={colors.textMuted}>{t('soil.noLive')}</AppText>}

      <SectionHeader title={t('soil.estimateTitle')} />
      {!pt ? <Banner message={t('soil.noLocation')} /> : est.isLoading ? <LoadingList count={1} /> : est.error ? (
        <Banner tone="warning" message={t(est.error.message === 'errors.soil_no_data' ? 'soil.estimateNoData' : 'soil.estimateFailed')} />
      ) : est.data && (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <SourceBadge source="model" label={t('soil.modelled')} />
            {est.data.texture && <Chip icon="grain" label={t(`soil.texture.${est.data.texture}`)} />}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {top('phh2o') != null && tile('pH', String(top('phh2o')), ratePh(top('phh2o')))}
            {top('soc') != null && tile(t('soil.soc'), `${top('soc')} g/kg`, null)}
            {top('nitrogen') != null && tile(t('soil.totalN'), `${top('nitrogen')} g/kg`, null)}
            {top('clay') != null && tile(t('soil.clay'), `${top('clay')}%`, null)}
            {top('sand') != null && tile(t('soil.sand'), `${top('sand')}%`, null)}
            {top('cec') != null && tile('CEC', `${top('cec')} cmol/kg`, null)}
          </View>
          <AppText variant="labelSm" color={colors.textSubtle}>{t('soil.estimateNote')}</AppText>
          <Freshness at={est.data.fetched_at} staleAfterMin={60 * 24 * 90} source="ISRIC SoilGrids" />
        </Card>
      )}

      <InsightCard kind="soil" id={farm?.id ?? null} extra={est.data ? { texture: est.data.texture, ph: top('phh2o'), soc_g_kg: top('soc'), clay_pct: top('clay'), sand_pct: top('sand') } : null} />
      {farm && <SoilTestSheet visible={open} onClose={() => setOpen(false)} farmId={farm.id} />}
    </Screen>
  );
}

const FIELDS: { key: keyof SoilTest; label: string; unit: string; max: number }[] = [
  { key: 'ph', label: 'pH', unit: '', max: 14 }, { key: 'ec_dsm', label: 'EC', unit: 'dS/m', max: 50 }, { key: 'organic_carbon_pct', label: 'soil.oc', unit: '%', max: 100 },
  { key: 'nitrogen_kg_ha', label: 'soil.n', unit: 'kg/ha', max: 5000 }, { key: 'phosphorus_kg_ha', label: 'soil.p', unit: 'kg/ha', max: 5000 }, { key: 'potassium_kg_ha', label: 'soil.k', unit: 'kg/ha', max: 5000 },
  { key: 'sulphur_ppm', label: 'soil.s', unit: 'ppm', max: 5000 }, { key: 'zinc_ppm', label: 'soil.zn', unit: 'ppm', max: 500 },
];
function SoilTestSheet({ visible, onClose, farmId }: { visible: boolean; onClose: () => void; farmId: string }) {
  const { t } = useTranslation();
  const add = useAddSoilTest();
  const [v, setV] = useState<Record<string, string>>({});
  const [date, setDate] = useState(today());
  const [source, setSource] = useState<SoilTest['source']>('soil_health_card');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setV({}); setDate(today()); setError(null); } }, [visible]);
  const save = async () => {
    const row: Partial<SoilTest> = { farm_id: farmId, tested_on: date, source, lab_name: v.lab_name?.trim() || null };
    for (const f of FIELDS) {
      const s = (v[f.key] ?? '').trim();
      if (!s) continue;
      const n = Number(s.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > f.max) { setError(t('soil.invalid', { field: t(f.label) })); return; }
      (row as Record<string, unknown>)[f.key] = n;
    }
    if (FIELDS.every((f) => row[f.key] == null)) { setError(t('soil.enterOne')); return; }
    try { await add.mutateAsync(row); onClose(); } catch { setError(t('errors.generic')); }
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('soil.addTest')}</AppText>
      <ChoiceChips value={source} onChange={setSource} options={(['soil_health_card', 'lab', 'field_kit'] as const).map((s) => ({ value: s, label: t(`soil.src.${s}`) }))} />
      <DateField label={t('soil.testedOn')} value={date} onChange={setDate} />
      <TextField label={t('soil.labName')} value={v.lab_name ?? ''} onChangeText={(x) => setV({ ...v, lab_name: x })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FIELDS.map((f) => (
          <View key={f.key} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <TextField label={`${t(f.label)}${f.unit ? ` (${f.unit})` : ''}`} keyboardType="decimal-pad" value={v[f.key] ?? ''} onChangeText={(x) => setV({ ...v, [f.key]: x })} />
          </View>
        ))}
      </View>
      {error && <Banner tone="error" message={error} />}
      <Button label={t('common.save')} iconLeft="check" loading={add.isPending} onPress={save} />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}
