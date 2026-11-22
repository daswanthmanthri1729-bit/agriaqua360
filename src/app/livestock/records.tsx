// 30 · Animal Health and Vaccination Records — add forms open inline (no nested modals with the photo picker)
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Checkbox, Chip, ChoiceChips, DateField, EmptyState, ErrorState, Header, LoadingList, PhotoPicker, Screen, StorageImage, TextField } from '@/components';
import { useAddHealthRecord, useAddVaccination, useAnimals, useHealthRecords, useVaccinations } from '@/features/livestock/api';
import { animalLabel, SPECIES_EMOJI } from '@/features/livestock/AnimalRow';
import { HEALTH_TYPES, healthSchema, HealthInput, VACCINES, vaccinationSchema, VaccinationInput } from '@/features/livestock/schemas';
import { VaccRow } from '@/features/livestock/VaccRow';
import { toErrorKey } from '@/features/auth/api';
import { formatDate, today } from '@/lib/dates';
import type { PickedImage } from '@/services/media';
import type { Animal } from '@/types/database';
import { colors, radius } from '@/theme';

type Tab = 'health' | 'vacc';
const issuesOf = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]));

export default function Records() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ animalId?: string; tab?: Tab; add?: string }>();
  const animals = useAnimals();
  const [animalId, setAnimalId] = useState(params.animalId ?? 'all');
  const [tab, setTab] = useState<Tab>(params.tab ?? 'health');
  const [adding, setAdding] = useState(params.add === '1');
  const filter = animalId === 'all' ? undefined : animalId;
  const health = useHealthRecords(filter);
  const vaccs = useVaccinations(filter);
  const animal = animals.data?.find((a) => a.id === animalId);
  const active = (animals.data ?? []).filter((a) => a.status !== 'sold' && a.status !== 'deceased');
  const q = tab === 'health' ? health : vaccs;

  return (
    <Screen footer={!adding && animal ? <Button testID="records-add" iconLeft="add" label={tab === 'health' ? t('livestock.addHealth') : t('livestock.addVacc')} onPress={() => setAdding(true)} /> : undefined}>
      <Header title={t('livestock.recordsTitle')} />
      <ChoiceChips scroll value={animalId} onChange={(v) => { setAnimalId(v); setAdding(false); }}
        options={[{ value: 'all', label: t('livestock.allAnimalsFilter') }, ...active.map((a) => ({ value: a.id, label: `${SPECIES_EMOJI[a.species]} ${animalLabel(a)}` }))]} />
      <ChoiceChips value={tab} onChange={(v) => { setTab(v); setAdding(false); }}
        options={[{ value: 'health', label: t('livestock.health'), icon: 'medical-services' }, { value: 'vacc', label: t('livestock.vaccinations'), icon: 'vaccines' }]} />

      {adding && animal && (tab === 'health'
        ? <HealthForm animal={animal} onDone={() => setAdding(false)} />
        : <VaccForm animal={animal} onDone={() => setAdding(false)} />)}

      {animals.isLoading || q.isLoading ? <LoadingList height={80} /> : q.error ? <ErrorState onRetry={() => q.refetch()} /> : !animals.data?.length ? (
        <EmptyState icon="pets" title={t('livestock.emptyTitle')} text={t('livestock.emptyText')} />
      ) : tab === 'vacc' ? (
        <Card style={{ paddingVertical: 4 }}>
          {vaccs.data!.length ? vaccs.data!.map((v) => <VaccRow key={v.id} v={v} showAnimal={animalId === 'all'} />)
            : <AppText variant="bodyMd" color={colors.textMuted} style={{ paddingVertical: 12 }}>{t('livestock.noVacc')}</AppText>}
        </Card>
      ) : health.data!.length ? health.data!.map((h) => (
        <Card key={h.id} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip tone={h.record_type === 'illness' || h.record_type === 'injury' ? 'warning' : 'normal'} label={t(`livestock.healthTypes.${h.record_type === 'ai_assessment' ? 'checkup' : h.record_type}`)} />
            <AppText variant="labelSm" color={colors.textSubtle}>{formatDate(h.recorded_on, i18n.language)}</AppText>
            {animalId === 'all' && h.animal && <AppText variant="labelSm">{SPECIES_EMOJI[h.animal.species]} {animalLabel(h.animal)}</AppText>}
          </View>
          {!!h.description && <AppText variant="bodyMd">{h.description}</AppText>}
          {(h.vet_name || h.follow_up_on) && (
            <AppText variant="bodySm" color={colors.textMuted}>
              {[h.vet_name, h.follow_up_on && `${t('livestock.followUp')}: ${formatDate(h.follow_up_on, i18n.language)}`].filter(Boolean).join(' • ')}
            </AppText>
          )}
          {!!h.image_paths.length && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {h.image_paths.map((p) => <StorageImage key={p} path={p} style={{ width: 72, height: 72, borderRadius: radius.md }} />)}
            </View>
          )}
        </Card>
      )) : <AppText variant="bodyMd" color={colors.textMuted}>{t('livestock.noHealth')}</AppText>}
      {!animal && !!animals.data?.length && <Banner message={t('validation.selectAnimal')} />}
      <Banner tone="info" message={t('livestock.consultVet')} />
    </Screen>
  );
}

function HealthForm({ animal, onDone }: { animal: Animal; onDone: () => void }) {
  const { t } = useTranslation();
  const add = useAddHealthRecord();
  const [v, setV] = useState<HealthInput>({ record_type: animal.status === 'sick' ? 'illness' : 'checkup', recorded_on: today(), description: '', vet_name: '', follow_up_on: '' });
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const r = healthSchema.safeParse(v);
    if (!r.success) { setErrors(issuesOf(r)); return; }
    try {
      await add.mutateAsync({ animalId: animal.id, input: r.data, photos, reminder: { title: t('livestock.reminderHealthTitle'), body: `${animalLabel(animal)}: ${r.data.description}` } });
      onDone();
    } catch (e) { setError(toErrorKey(e)); }
  };
  return (
    <Card style={{ gap: 14, borderColor: colors.secondary }}>
      <AppText variant="headlineSm">{t('livestock.addHealth')} · {animalLabel(animal)}</AppText>
      <ChoiceChips scroll label={t('livestock.recordType')} value={v.record_type} onChange={(record_type) => setV({ ...v, record_type })}
        options={HEALTH_TYPES.map((x) => ({ value: x, label: t(`livestock.healthTypes.${x}`) }))} />
      <DateField label={t('livestock.date')} required value={v.recorded_on} onChange={(recorded_on) => setV({ ...v, recorded_on })} error={errors.recorded_on && t(errors.recorded_on)} />
      <TextField testID="health-desc" label={t('livestock.description')} required multiline style={{ minHeight: 72, textAlignVertical: 'top' }}
        value={v.description} onChangeText={(description) => setV({ ...v, description })} error={errors.description && t(errors.description)} />
      <TextField label={t('livestock.vet')} icon="person-outline" value={v.vet_name} onChangeText={(vet_name) => setV({ ...v, vet_name })} error={errors.vet_name && t(errors.vet_name)} />
      <DateField label={t('livestock.followUp')} value={v.follow_up_on} onChange={(follow_up_on) => setV({ ...v, follow_up_on })} minimumDate={v.recorded_on} error={errors.follow_up_on && t(errors.follow_up_on)} />
      <PhotoPicker label={t('livestock.photos')} value={photos} onChange={setPhotos} max={3} />
      {error && <Banner tone="error" message={t(error)} />}
      <Button testID="health-save" label={t('common.save')} iconLeft="check" loading={add.isPending} onPress={save} />
      <Button variant="text" label={t('common.cancel')} onPress={onDone} />
    </Card>
  );
}

function VaccForm({ animal, onDone }: { animal: Animal; onDone: () => void }) {
  const { t } = useTranslation();
  const add = useAddVaccination();
  const [v, setV] = useState<VaccinationInput>({ vaccine_name: '', dose: '', given: false, date: today(), notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    const r = vaccinationSchema.safeParse(v);
    if (!r.success) { setErrors(issuesOf(r)); return; }
    try {
      await add.mutateAsync({ animalId: animal.id, input: r.data, reminder: { title: t('livestock.reminderVaccTitle'), body: `${animalLabel(animal)}: ${r.data.vaccine_name}` } });
      onDone();
    } catch (e) { setError(toErrorKey(e)); }
  };
  return (
    <Card style={{ gap: 14, borderColor: colors.secondary }}>
      <AppText variant="headlineSm">{t('livestock.addVacc')} · {animalLabel(animal)}</AppText>
      <TextField testID="vacc-name" label={t('livestock.vaccine')} required icon="vaccines" value={v.vaccine_name} onChangeText={(vaccine_name) => setV({ ...v, vaccine_name })} error={errors.vaccine_name && t(errors.vaccine_name)} />
      <ChoiceChips scroll value={VACCINES[animal.species].includes(v.vaccine_name) ? v.vaccine_name : null} onChange={(vaccine_name) => setV({ ...v, vaccine_name })}
        options={VACCINES[animal.species].map((x) => ({ value: x, label: x }))} />
      <TextField label={t('livestock.dose')} value={v.dose} onChangeText={(dose) => setV({ ...v, dose })} error={errors.dose && t(errors.dose)} />
      <Checkbox checked={v.given} onChange={(given) => setV({ ...v, given })} label={t('livestock.given')}>
        <AppText variant="bodyMd">{t('livestock.given')}</AppText>
      </Checkbox>
      <DateField label={v.given ? t('livestock.givenOn') : t('livestock.dueOn')} required value={v.date} onChange={(date) => setV({ ...v, date })} error={errors.date && t(errors.date)} />
      {error && <Banner tone="error" message={t(error)} />}
      <Button testID="vacc-save" label={t('common.save')} iconLeft="check" loading={add.isPending} onPress={save} />
      <Button variant="text" label={t('common.cancel')} onPress={onDone} />
    </Card>
  );
}
