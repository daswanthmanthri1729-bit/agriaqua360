// 15 · Add New Crop — follows Add Farm form pattern
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, ChoiceChips, DateField, EmptyState, Header, LoadingList, PhotoPicker, Screen, TextField } from '@/components';
import { useCreateCrop, useFarms } from '@/features/agriculture/api';
import { COMMON_CROPS, cropSchema, CropInput, SEASONS } from '@/features/agriculture/schemas';
import { toErrorKey } from '@/features/auth/api';
import type { PickedImage } from '@/services/media';
import { colors } from '@/theme';

export default function AddCrop() {
  const { t } = useTranslation();
  const { farmId } = useLocalSearchParams<{ farmId?: string }>();
  const farms = useFarms();
  const create = useCreateCrop();
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<CropInput>({
    resolver: zodResolver(cropSchema),
    defaultValues: { farm_id: farmId ?? '', name: '', variety: '', season: '', area_acres: '', sowing_date: '', expected_harvest_date: '', notes: '' },
  });
  const err = (e?: { message?: string }) => (e?.message ? t(e.message) : undefined);
  const farmList = farms.data ?? [];
  useEffect(() => {
    if (!farmId && farms.data?.length === 1) setValue('farm_id', farms.data[0].id);
  }, [farmId, farms.data, setValue]);

  const onSubmit = handleSubmit(async (input) => {
    setError(null);
    try {
      const crop = await create.mutateAsync({ input, photo: photos[0] });
      router.replace(`/agriculture/crops/${crop.id}`);
    } catch (e) { setError(toErrorKey(e)); }
  });

  if (farms.isLoading) return <Screen><Header /><LoadingList /></Screen>;
  if (!farmList.length) {
    return (
      <Screen>
        <Header />
        <EmptyState icon="add-location-alt" title={t('crops.needFarm')} action={t('farms.add')} onAction={() => router.replace('/agriculture/farms/new')} />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button testID="crop-save" label={t('cropForm.save')} iconLeft="check" loading={create.isPending} onPress={onSubmit} />}>
      <Header />
      <View style={{ gap: 6 }}>
        <AppText variant="display" accessibilityRole="header">{t('cropForm.title')}</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('cropForm.subtitle')}</AppText>
      </View>
      <Controller control={control} name="farm_id" render={({ field }) => (
        <ChoiceChips label={t('cropForm.farm')} value={field.value || null} onChange={field.onChange} error={err(errors.farm_id)}
          options={farmList.map((f) => ({ value: f.id, label: f.name, icon: 'landscape' as const }))} />
      )} />
      <Controller control={control} name="name" render={({ field }) => (
        <View style={{ gap: 8 }}>
          <TextField testID="crop-name" label={t('cropForm.name')} required icon="eco" placeholder={t('cropForm.namePlaceholder')}
            value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={err(errors.name)} />
          <ChoiceChips scroll value={null} onChange={(k) => field.onChange(t(`crops.names.${k}`))}
            options={COMMON_CROPS.map((k) => ({ value: k, label: t(`crops.names.${k}`) }))} />
        </View>
      )} />
      <Controller control={control} name="variety" render={({ field }) => (
        <TextField label={t('cropForm.variety')} placeholder={t('cropForm.varietyPlaceholder')} value={field.value} onChangeText={field.onChange} error={err(errors.variety)} />
      )} />
      <Controller control={control} name="season" render={({ field }) => (
        <ChoiceChips label={t('cropForm.season')} value={field.value || null} onChange={field.onChange} options={SEASONS.map((s) => ({ value: s, label: t(`crops.seasons.${s}`) }))} />
      )} />
      <Controller control={control} name="area_acres" render={({ field }) => (
        <TextField label={t('cropForm.area')} icon="square-foot" keyboardType="decimal-pad" value={field.value} onChangeText={field.onChange} error={err(errors.area_acres)} />
      )} />
      <Controller control={control} name="sowing_date" render={({ field }) => (
        <DateField label={t('cropForm.sowing')} value={field.value} onChange={field.onChange} error={err(errors.sowing_date)} />
      )} />
      <Controller control={control} name="expected_harvest_date" render={({ field }) => (
        <DateField label={t('cropForm.harvest')} value={field.value} onChange={field.onChange} error={err(errors.expected_harvest_date)} minimumDate={watch('sowing_date') || undefined} />
      )} />
      <PhotoPicker label={t('cropForm.photo')} value={photos} onChange={setPhotos} />
      <Controller control={control} name="notes" render={({ field }) => (
        <TextField label={t('cropForm.notes')} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} value={field.value} onChangeText={field.onChange} error={err(errors.notes)} />
      )} />
      {error && <Banner tone="error" message={t(error)} />}
    </Screen>
  );
}
