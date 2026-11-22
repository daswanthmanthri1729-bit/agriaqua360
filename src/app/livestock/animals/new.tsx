// 29 · Add New Animal
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, ChoiceChips, DateField, Header, PhotoPicker, Screen, TextField } from '@/components';
import { useCreateAnimal } from '@/features/livestock/api';
import { SPECIES_EMOJI } from '@/features/livestock/AnimalRow';
import { ANIMAL_STATUS, animalSchema, AnimalInput, BREEDS, SPECIES } from '@/features/livestock/schemas';
import { toErrorKey } from '@/features/auth/api';
import type { PickedImage } from '@/services/media';
import type { Species } from '@/types/database';
import { colors } from '@/theme';

export default function AddAnimal() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ species?: Species }>();
  const create = useCreateAnimal();
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<AnimalInput>({
    resolver: zodResolver(animalSchema),
    defaultValues: { species: params.species ?? 'cow', tag_id: '', name: '', breed: '', sex: '', birth_date: '', weight_kg: '', status: 'healthy', notes: '' },
  });
  const err = (e?: { message?: string }) => (e?.message ? t(e.message) : undefined);
  const species = watch('species');

  const onSubmit = handleSubmit(async (input) => {
    setError(null);
    try {
      const a = await create.mutateAsync({ input, photo: photos[0] });
      router.replace(`/livestock/animals/${a.id}`);
    } catch (e) { setError(toErrorKey(e)); }
  });

  const text = (name: 'tag_id' | 'name' | 'weight_kg' | 'notes', label: string, extra: object = {}) => (
    <Controller control={control} name={name} render={({ field }) => (
      <TextField label={label} value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={err(errors[name])} {...extra} />
    )} />
  );

  return (
    <Screen footer={<Button testID="animal-save" label={t('livestock.save')} iconLeft="check" loading={create.isPending} onPress={onSubmit} />}>
      <Header />
      <View style={{ gap: 6 }}>
        <AppText variant="display" accessibilityRole="header">{t('livestock.addTitle')}</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('livestock.addSubtitle')}</AppText>
      </View>
      <Controller control={control} name="species" render={({ field }) => (
        <ChoiceChips value={field.value} onChange={(v) => { field.onChange(v); setValue('breed', ''); }}
          options={SPECIES.map((s) => ({ value: s, label: `${SPECIES_EMOJI[s]} ${t(`livestock.species.${s}`)}` }))} />
      )} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>{text('tag_id', t('livestock.tag'), { icon: 'tag', testID: 'animal-tag', autoCapitalize: 'characters' })}</View>
        <View style={{ flex: 1 }}>{text('name', t('livestock.name'), { testID: 'animal-name' })}</View>
      </View>
      <Controller control={control} name="breed" render={({ field }) => (
        <View style={{ gap: 8 }}>
          <TextField label={t('livestock.breed')} value={field.value} onChangeText={field.onChange} error={err(errors.breed)} />
          <ChoiceChips scroll value={BREEDS[species].includes(field.value) ? field.value : null} onChange={field.onChange} options={BREEDS[species].map((b) => ({ value: b, label: b }))} />
        </View>
      )} />
      <Controller control={control} name="sex" render={({ field }) => (
        <ChoiceChips label={t('livestock.sex')} value={field.value || null} onChange={field.onChange}
          options={[{ value: 'female', label: t('livestock.female') }, { value: 'male', label: t('livestock.male') }]} />
      )} />
      <Controller control={control} name="birth_date" render={({ field }) => (
        <DateField label={t('livestock.birthDate')} value={field.value} onChange={field.onChange} error={err(errors.birth_date)} />
      )} />
      {text('weight_kg', t('livestock.weight'), { keyboardType: 'decimal-pad', icon: 'monitor-weight' })}
      <Controller control={control} name="status" render={({ field }) => (
        <ChoiceChips scroll label={t('livestock.status')} value={field.value} onChange={field.onChange}
          options={ANIMAL_STATUS.filter((s) => s !== 'sold' && s !== 'deceased').map((s) => ({ value: s, label: t(`livestock.statuses.${s}`) }))} />
      )} />
      <PhotoPicker label={t('livestock.photo')} value={photos} onChange={setPhotos} />
      {text('notes', t('livestock.notes'), { multiline: true, style: { minHeight: 80, textAlignVertical: 'top' } })}
      {error && <Banner tone="error" message={t(error)} />}
    </Screen>
  );
}
