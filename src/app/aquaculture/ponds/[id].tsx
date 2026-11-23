// 23 · Pond Details — Stitch: 28_pond_details (HTML) + 31/35/37/38/39 record screens folded into one records list
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, DateField, ErrorState, Header, InfoTile, LineChart, LoadingList, Screen, SectionHeader, Sheet, SourceBadge, TextField } from '@/components';
import { ago } from '@/components/Freshness';
import { pondPerformance } from '@/features/aquaculture/performance';
import { RANGES } from '@/features/aquaculture/waterQuality';
import { InsightCard } from '@/features/intel/InsightCard';
import { SENSOR_UNITS, useLatestFor, useRealtime } from '@/features/iot/api';
import { useAddFishRecord, useDeletePond, useFishRecords, useFishReports, usePond, useReadings, useUpdatePond } from '@/features/aquaculture/api';
import { FISH_RECORD_TYPES, fishRecordSchema, FishRecordInput, MORTALITY_CAUSES, POND_STATUS, UNITS } from '@/features/aquaculture/schemas';
import { WaterTiles } from '@/features/aquaculture/WaterTiles';
import { toErrorKey } from '@/features/auth/api';
import { daysBetween, formatDate, isoDate, today } from '@/lib/dates';
import { colors } from '@/theme';
import type { PondStatus } from '@/types/database';

export default function PondDetails() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pond = usePond(id);
  const readings = useReadings(id);
  const records = useFishRecords(id);
  const reports = useFishReports(id);
  const update = useUpdatePond();
  const del = useDeletePond();
  const [recordOpen, setRecordOpen] = useState(false);
  const live = useLatestFor({ pondId: id });
  useRealtime('sensor_readings', `pond_id=eq.${id}`, [['latest'], ['readings']]);
  const [param, setParam] = useState<'dissolved_oxygen_mgl' | 'temperature_c' | 'ph' | 'ammonia_mgl'>('dissolved_oxygen_mgl');
  const trend = useMemo(() => [...(readings.data ?? [])].reverse().filter((r) => r[param] != null).map((r) => ({ x: Date.parse(r.recorded_at), y: Number(r[param]) })), [readings.data, param]);

  if (pond.isLoading) return <Screen><Header /><LoadingList height={140} /></Screen>;
  if (!pond.data) return <Screen><Header /><ErrorState onRetry={() => pond.refetch()} /></Screen>;
  const p = pond.data;
  const latest = readings.data?.[0];
  const doc = p.stocking_date && p.status === 'active' ? daysBetween(p.stocking_date, today()) : null;
  const fmt = (d: string | null) => (d ? formatDate(d, i18n.language) : '—');

  const confirmDelete = () =>
    Alert.alert(t('ponds.deleteTitle'), t('ponds.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try { await del.mutateAsync(p.id); router.back(); } catch { Alert.alert(t('errors.generic')); }
      } },
    ]);

  return (
    <Screen footer={
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} variant="secondary" iconLeft="science" label={t('aqua.addReading')} onPress={() => router.push({ pathname: '/aquaculture/water-quality', params: { pondId: p.id, add: '1' } })} />
        <Button style={{ flex: 1 }} variant="ai" iconLeft="set-meal" label={t('aqua.scanFish')} onPress={() => router.push({ pathname: '/aquaculture/fish-scan', params: { pondId: p.id } })} />
      </View>
    }>
      <Header title={t('ponds.details')} right={<Button compact variant="text" iconLeft="delete-outline" label={t('common.delete')} onPress={confirmDelete} loading={del.isPending} />} />
      <View style={{ gap: 6 }}>
        <AppText variant="display">{p.name}</AppText>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {!!p.species && <Chip icon="set-meal" label={p.species} />}
          {doc != null && doc >= 0 && <Chip tone="ai" icon="timelapse" label={t('aqua.doc', { count: doc })} />}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <InfoTile icon="square-foot" label={t('ponds.area')} value={p.area_acres != null ? `${p.area_acres} ${t('common.acres')}` : '—'} />
        <InfoTile icon="straighten" label={t('ponds.depth')} value={p.depth_m != null ? `${p.depth_m} m` : '—'} />
        <InfoTile icon="event" label={t('ponds.stockingDate')} value={fmt(p.stocking_date)} />
        <InfoTile icon="numbers" label={t('ponds.stockingCount')} value={p.stocking_count != null ? p.stocking_count.toLocaleString() : '—'} />
      </View>
      <ChoiceChips scroll label={t('ponds.status')} value={p.status}
        onChange={(status: PondStatus) => update.mutate({ id: p.id, patch: { status } }, { onError: () => Alert.alert(t('errors.generic')) })}
        options={POND_STATUS.map((s) => ({ value: s, label: t(`ponds.statuses.${s}`) }))} />

      <SectionHeader title={t('aqua.latest')} action={t('ponds.waterHistory')} onAction={() => router.push({ pathname: '/aquaculture/water-quality', params: { pondId: p.id } })} />
      {latest ? (
        <>
          <AppText variant="bodySm" color={colors.textSubtle}>{t('aqua.readingAge', { date: formatDate(isoDate(new Date(latest.recorded_at)), i18n.language) })}</AppText>
          <WaterTiles reading={latest} />
        </>
      ) : <Banner message={t('aqua.noReadings')} />}

      <SectionHeader title={t('ponds.liveSensors')} action={live.data?.length ? t('devices.fullHistory') : t('monitor.addDevice')}
        onAction={() => (live.data?.length ? router.push({ pathname: '/monitor/history', params: { device: live.data[0].device_id } }) : router.push('/monitor/add'))} />
      {live.data?.length ? (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {live.data.filter((v) => v.sensor_type !== 'battery').map((v) => (
              <View key={`${v.device_id}${v.sensor_type}`} style={{ flexGrow: 1, flexBasis: '30%', padding: 10, borderRadius: 12, backgroundColor: colors.surfaceLow }}>
                <AppText variant="labelSm" color={colors.textSubtle}>{t(`sensors.${v.sensor_type}`)}</AppText>
                <AppText variant="labelLg">{v.value} {SENSOR_UNITS[v.sensor_type]}</AppText>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <SourceBadge source={live.data[0].source} />
            <AppText variant="labelSm" color={colors.textSubtle}>{ago(live.data[0].recorded_at, t)}</AppText>
          </View>
        </Card>
      ) : <AppText variant="bodyMd" color={colors.textMuted}>{t('ponds.noSensors')}</AppText>}

      {trend.length > 1 && (
        <Card style={{ gap: 8 }}>
          <AppText variant="labelLg">{t('ponds.trend')}</AppText>
          <ChoiceChips scroll value={param} onChange={setParam} options={(['dissolved_oxygen_mgl', 'temperature_c', 'ph', 'ammonia_mgl'] as const).map((k) => ({ value: k, label: t(`water.params.${k}`) }))} />
          <LineChart series={[{ points: trend, color: colors.water, label: t(`water.params.${param}`) }]}
            limits={RANGES[param] ? [RANGES[param]!.ok[0] > 0 && { y: RANGES[param]!.ok[0], label: t('thresholds.min') }, Number.isFinite(RANGES[param]!.ok[1]) && { y: RANGES[param]!.ok[1], label: t('thresholds.max') }].filter(Boolean) as { y: number; label: string }[] : []}
            formatX={(x) => formatDate(isoDate(new Date(x)), i18n.language, { day: 'numeric', month: 'short' })} />
        </Card>
      )}

      <InsightCard kind="water" id={p.id} />

      {(() => {
        const perf = pondPerformance(p, records.data ?? []);
        if (!perf.stocked) return null;
        return (
          <>
            <SectionHeader title={t('ponds.performance')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <InfoTile icon="favorite" label={t('ponds.survival')} value={perf.survivalPct != null ? `${perf.survivalPct}% (${perf.alive.toLocaleString()})` : '—'} />
              <InfoTile icon="scale" label={t('ponds.biomass')} value={perf.biomassKg != null ? `~${perf.biomassKg.toLocaleString()} kg` : t('ponds.needSample')} />
              <InfoTile icon="set-meal" label={t('ponds.feedUsed')} value={`${perf.feedKg.toLocaleString()} kg`} />
              <InfoTile icon="calculate" label="FCR" value={perf.fcr != null ? String(perf.fcr) : '—'} />
            </View>
            <AppText variant="labelSm" color={colors.textSubtle}>{t('ponds.perfNote')}</AppText>
          </>
        );
      })()}

      <SectionHeader title={t('ponds.records')} action={t('ponds.addRecord')} onAction={() => setRecordOpen(true)} />
      <Card style={{ gap: 10 }}>
        {records.isLoading ? <LoadingList count={2} height={40} /> : records.data?.length ? records.data.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Chip label={t(`ponds.types.${r.record_type}`)} tone={r.record_type === 'mortality' ? 'error' : 'normal'} />
            <AppText variant="bodyMd" style={{ flex: 1 }} numberOfLines={2}>
              {[r.quantity != null && `${r.quantity} ${t(`ponds.units.${r.unit === 'pcs' ? 'pcs' : 'kg'}`)}`, r.avg_weight_g != null && `${r.avg_weight_g} g`, r.feed_type, r.cause && t(`ponds.causes.${r.cause}`), r.notes].filter(Boolean).join(' • ')}
            </AppText>
            <AppText variant="labelSm" color={colors.textSubtle}>{fmt(r.recorded_on)}</AppText>
          </View>
        )) : <AppText variant="bodyMd" color={colors.textMuted}>{t('ponds.noRecords')}</AppText>}
      </Card>

      <SectionHeader title={t('ponds.health')} />
      {reports.data?.length ? reports.data.map((r) => (
        <Card key={r.id} onPress={() => router.push({ pathname: '/aquaculture/fish-scan', params: { pondId: p.id, reportId: r.id } })} accessibilityLabel={r.condition_name ?? ''}
          style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="labelLg" numberOfLines={1}>{r.condition_name}</AppText>
            <AppText variant="bodySm" color={colors.textMuted}>{formatDate(isoDate(new Date(r.created_at)), i18n.language)}</AppText>
          </View>
          {r.severity && <Chip tone={r.severity === 'severe' ? 'error' : r.severity === 'none' ? 'normal' : 'warning'} label={t(`result.severity.${r.severity}`)} />}
        </Card>
      )) : <AppText variant="bodyMd" color={colors.textMuted}>{t('ponds.noHealth')}</AppText>}

      <FishRecordSheet visible={recordOpen} onClose={() => setRecordOpen(false)} pondId={p.id} />
    </Screen>
  );
}

function FishRecordSheet({ visible, onClose, pondId }: { visible: boolean; onClose: () => void; pondId: string }) {
  const { t } = useTranslation();
  const add = useAddFishRecord();
  const blank = (): FishRecordInput => ({ record_type: 'feeding', recorded_on: today(), quantity: '', unit: 'kg', avg_weight_g: '', notes: '' });
  const [v, setV] = useState<FishRecordInput>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setV(blank()); setErrors({}); setError(null); } }, [visible]);

  const save = async () => {
    const r = fishRecordSchema.safeParse(v);
    if (!r.success) { setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    try { await add.mutateAsync({ pondId, input: r.data }); onClose(); } catch (e) { setError(toErrorKey(e)); }
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('ponds.addRecord')}</AppText>
      <ChoiceChips label={t('ponds.recordType')} value={v.record_type} onChange={(record_type) => setV({ ...v, record_type, unit: record_type === 'stocking' || record_type === 'mortality' ? 'pcs' : 'kg' })}
        options={FISH_RECORD_TYPES.map((x) => ({ value: x, label: t(`ponds.types.${x}`) }))} />
      <DateField label={t('ponds.date')} required value={v.recorded_on} onChange={(recorded_on) => setV({ ...v, recorded_on })} error={errors.recorded_on && t(errors.recorded_on)} />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <TextField testID="fr-qty" label={t('ponds.quantity')} keyboardType="decimal-pad" value={v.quantity} onChangeText={(quantity) => setV({ ...v, quantity })} error={errors.quantity && t(errors.quantity)} />
        </View>
        <ChoiceChips value={v.unit} onChange={(unit) => setV({ ...v, unit })} options={UNITS.map((u) => ({ value: u, label: t(`ponds.units.${u}`) }))} />
      </View>
      {v.record_type === 'mortality' && (
        <ChoiceChips scroll label={t('ponds.cause')} value={v.cause ?? null} onChange={(cause) => setV({ ...v, cause })} options={MORTALITY_CAUSES.map((c) => ({ value: c, label: t(`ponds.causes.${c}`) }))} />
      )}
      {v.record_type === 'feeding' && (
        <TextField label={t('ponds.feedType')} value={v.feed_type ?? ''} onChangeText={(feed_type) => setV({ ...v, feed_type })} />
      )}
      {v.record_type === 'sampling' && (
        <TextField label={t('ponds.avgWeight')} keyboardType="decimal-pad" value={v.avg_weight_g} onChangeText={(avg_weight_g) => setV({ ...v, avg_weight_g })} error={errors.avg_weight_g && t(errors.avg_weight_g)} />
      )}
      <TextField label={t('ponds.notes')} value={v.notes} onChangeText={(notes) => setV({ ...v, notes })} error={errors.notes && t(errors.notes)} />
      {error && <Banner tone="error" message={t(error)} />}
      <Button testID="fr-save" label={t('common.save')} iconLeft="check" loading={add.isPending} onPress={save} />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}
