// Animal production records (milk, weight, feeding, breeding) and collar data — designs: individual_animal_profile_digital_records,
// livestock_nutrition_feed_productivity_intelligence, smart_livestock_wearable_dashboard, gps_livestock_location_geofencing.
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Button, Card, ChoiceChips, DateField, Icon, LineChart, SectionHeader, Sheet, SourceBadge, TextField, TileMap } from '@/components';
import { ago } from '@/components/Freshness';
import { SENSOR_UNITS, useLatestFor, useRealtime } from '@/features/iot/api';
import { addDays, formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';
import type { Animal, AnimalRecord, AnimalRecordType } from '@/types/database';
import { useAddAnimalRecord, useAnimalLocations, useAnimalRecords, useDeleteAnimalRecord, useGeofences } from './api';

const MILKERS = ['cow', 'buffalo', 'goat', 'sheep'];
const BREEDING: AnimalRecordType[] = ['heat', 'insemination', 'pregnancy_check', 'birth', 'dry_off'];
const GESTATION_DAYS: Record<string, number> = { cow: 283, buffalo: 310, goat: 150, sheep: 147, pig: 114 };

/** Expected birth date from an insemination date (species average gestation). */
export const dueFromInsemination = (species: string, date: string) => (GESTATION_DAYS[species] ? addDays(date, GESTATION_DAYS[species]) : null);

export function AnimalProduction({ animal }: { animal: Animal }) {
  const { t, i18n } = useTranslation();
  const q = useAnimalRecords(animal.id);
  const del = useDeleteAnimalRecord();
  const milker = MILKERS.includes(animal.species) && animal.sex !== 'male';
  const [view, setView] = useState<'milk' | 'weight' | 'feeding' | 'breeding'>(milker ? 'milk' : 'weight');
  const [open, setOpen] = useState(false);
  const recs = q.data ?? [];
  const milk = useMemo(() => {
    const byDay = new Map<string, number>();
    recs.filter((r) => r.record_type === 'milk').forEach((r) => byDay.set(r.recorded_on, (byDay.get(r.recorded_on) ?? 0) + Number(r.value ?? 0)));
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-30);
  }, [recs]);
  const weights = recs.filter((r) => r.record_type === 'weight').map((r) => ({ x: Date.parse(r.recorded_on), y: Number(r.value) })).reverse();
  const breeding = recs.filter((r) => BREEDING.includes(r.record_type));
  const due = breeding.find((r) => r.record_type === 'insemination' && r.due_on && r.due_on >= today());
  const week = milk.slice(-7).reduce((s, [, v]) => s + v, 0);
  const list = view === 'breeding' ? breeding : recs.filter((r) => r.record_type === view);

  return (
    <>
      <SectionHeader title={t('animal.production')} action={t('animal.addRecord')} onAction={() => setOpen(true)} />
      <ChoiceChips scroll value={view} onChange={setView} options={[...(milker ? ['milk'] : []), 'weight', 'feeding', 'breeding'].map((v) => ({ value: v as typeof view, label: t(`animal.views.${v}`) }))} />
      <Card style={{ gap: 10 }}>
        {view === 'milk' && (milk.length ? (
          <>
            <AppText variant="labelLg">{t('animal.milkWeek', { litres: Math.round(week * 10) / 10, avg: Math.round((week / Math.max(1, Math.min(7, milk.length))) * 10) / 10 })}</AppText>
            <BarChart bars={milk.map(([d, v]) => ({ label: formatDate(d, i18n.language, { day: 'numeric' }), value: v, color: colors.water }))} unit="L" height={130} formatY={(y) => `${Math.round(y)}`} />
          </>
        ) : <AppText color={colors.textMuted}>{t('animal.noMilk')}</AppText>)}
        {view === 'weight' && (weights.length > 1 ? (
          <LineChart series={[{ points: weights, label: t('livestock.weight') }]} unit="kg" height={150} formatX={(x) => formatDate(new Date(x).toISOString().slice(0, 10), i18n.language, { day: 'numeric', month: 'short' })} />
        ) : <AppText color={colors.textMuted}>{t('animal.weightHint')}</AppText>)}
        {view === 'breeding' && due && <Banner title={t('animal.dueTitle')} message={t('animal.dueText', { date: formatDate(due.due_on!, i18n.language) })} />}
        {list.slice(0, 8).map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <AppText variant="labelLg">{t(`animal.types.${r.record_type}`)}{r.value != null ? ` · ${r.value} ${r.record_type === 'milk' ? 'L' : 'kg'}` : ''}{r.session ? ` · ${t(`animal.session.${r.session}`)}` : ''}</AppText>
              <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>{formatDate(r.recorded_on, i18n.language)}{r.detail ? ` · ${r.detail}` : ''}{r.due_on ? ` · ${t('animal.due', { date: formatDate(r.due_on, i18n.language) })}` : ''}</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={10}
              onPress={() => Alert.alert(t('animal.deleteRecord'), '', [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: () => del.mutate(r.id) }])}>
              <Icon name="delete-outline" color={colors.textMuted} />
            </Pressable>
          </View>
        ))}
      </Card>
      <RecordSheet visible={open} onClose={() => setOpen(false)} animal={animal} initial={view === 'breeding' ? 'heat' : view} milker={milker} />
    </>
  );
}

function RecordSheet({ visible, onClose, animal, initial, milker }: { visible: boolean; onClose: () => void; animal: Animal; initial: AnimalRecordType; milker: boolean }) {
  const { t } = useTranslation();
  const add = useAddAnimalRecord();
  const [type, setType] = useState<AnimalRecordType>(initial);
  const [date, setDate] = useState(today());
  const [value, setValue] = useState('');
  const [session, setSession] = useState<'morning' | 'evening'>('morning');
  const [detail, setDetail] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setType(initial); setDate(today()); setValue(''); setDetail(''); setError(null); setSession(new Date().getHours() < 12 ? 'morning' : 'evening'); } }, [visible, initial]);
  const needsValue = type === 'milk' || type === 'weight' || type === 'feeding';
  const save = async () => {
    const v = Number(value.replace(',', '.'));
    if (needsValue && !(v > 0 && v < (type === 'weight' ? 3000 : 200))) { setError('animal.valueInvalid'); return; }
    const row: Partial<AnimalRecord> = { animal_id: animal.id, record_type: type, recorded_on: date, value: needsValue ? v : null, session: type === 'milk' ? session : null, detail: detail.trim() || null,
      due_on: type === 'insemination' ? dueFromInsemination(animal.species, date) : null };
    try { await add.mutateAsync(row); onClose(); } catch { setError('errors.generic'); }
  };
  const types: AnimalRecordType[] = [...(milker ? ['milk' as const] : []), 'weight', 'feeding', ...BREEDING];
  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('animal.addRecord')}</AppText>
      <ChoiceChips scroll value={type} onChange={setType} options={types.map((x) => ({ value: x, label: t(`animal.types.${x}`) }))} />
      <DateField label={t('livestock.date')} value={date} onChange={setDate} />
      {needsValue && <TextField label={type === 'milk' ? t('animal.litres') : t('animal.kg')} required keyboardType="decimal-pad" value={value} onChangeText={setValue} testID="animal-value" />}
      {type === 'milk' && <ChoiceChips value={session} onChange={setSession} options={[{ value: 'morning', label: t('animal.session.morning') }, { value: 'evening', label: t('animal.session.evening') }]} />}
      {!needsValue || type === 'feeding' ? <TextField label={t(`animal.detail.${type === 'feeding' ? 'feed' : 'note'}`)} value={detail} onChangeText={setDetail} maxLength={200} /> : null}
      {type === 'insemination' && GESTATION_DAYS[animal.species] && <Banner message={t('animal.dueAuto', { days: GESTATION_DAYS[animal.species] })} />}
      {error && <Banner tone="error" message={t(error)} />}
      <Button label={t('common.save')} iconLeft="check" loading={add.isPending} onPress={save} testID="animal-save" />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}

export function AnimalCollar({ animal }: { animal: Animal }) {
  const { t } = useTranslation();
  const live = useLatestFor({ animalId: animal.id });
  const locs = useAnimalLocations(animal.id);
  const fences = useGeofences();
  useRealtime('sensor_readings', `animal_id=eq.${animal.id}`, [['latest']]);
  useRealtime('animal_locations', `animal_id=eq.${animal.id}`, [['animalLocations']]);
  const last = locs.data?.[0];
  if (!live.data?.length && !last) return (
    <Button variant="secondary" iconLeft="pets" label={t('animal.addCollar')} onPress={() => router.push('/monitor/add')} />
  );
  const fever = live.data?.find((v) => v.sensor_type === 'body_temp' && v.value >= 39.5);
  return (
    <>
      <SectionHeader title={t('animal.collar')} action={t('animal.geofences')} onAction={() => router.push('/livestock/geofence')} />
      <Card style={{ gap: 10 }}>
        {fever && <Banner tone="error" message={t('animal.fever', { value: fever.value })} />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(live.data ?? []).map((v) => (
            <View key={v.sensor_type} style={{ flexGrow: 1, flexBasis: '30%', padding: 10, borderRadius: 12, backgroundColor: colors.surfaceLow }}>
              <AppText variant="labelSm" color={colors.textSubtle}>{t(`sensors.${v.sensor_type}`)}</AppText>
              <AppText variant="labelLg">{v.value} {SENSOR_UNITS[v.sensor_type]}</AppText>
            </View>
          ))}
        </View>
        {last && (
          <>
            <TileMap center={{ lat: last.latitude, lon: last.longitude }} zoom={16} height={200}
              polygons={(fences.data ?? []).map((f) => ({ points: f.polygon }))} markers={[{ lat: last.latitude, lon: last.longitude, label: animal.name ?? animal.tag_id ?? '' }]} />
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <SourceBadge source={last.source as 'sensor'} />
              <AppText variant="labelSm" color={colors.textSubtle}>{t('animal.lastSeen', { when: ago(last.recorded_at, t) })}</AppText>
            </View>
          </>
        )}
      </Card>
    </>
  );
}
