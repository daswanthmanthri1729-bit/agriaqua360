// 11 · Add New Farm — Stitch: 09_add_farm_screen (HTML only)
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, ChoiceChips, Header, PhotoPicker, Screen, TextField } from '@/components';
import { useCreateFarm } from '@/features/agriculture/api';
import { farmSchema, FarmInput, IRRIGATION, SOIL_TYPES } from '@/features/agriculture/schemas';
import { toErrorKey } from '@/features/auth/api';
import { currentPlace, LocationDeniedError } from '@/services/location';
import type { PickedImage } from '@/services/media';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

const TYPES = ['agriculture', 'aquaculture', 'livestock', 'mixed'] as const;

export default function AddFarm() {
  const { t } = useTranslation();
  const profile = useSession((s) => s.profile);
  const create = useCreateFarm();
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning' | 'error'; key: string } | null>(null);
  const { control, handleSubmit, setValue, formState: { errors } } = useForm<FarmInput>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      name: '', farm_type: 'agriculture', area_acres: '', soil_type: '', irrigation_source: '',
      village: profile?.village ?? '', district: profile?.district ?? '', state: profile?.state ?? '', notes: '',
    },
  });
  const err = (e?: { message?: string }) => (e?.message ? t(e.message) : undefined);

  const locate = async () => {
    setLocating(true); setNotice(null);
    try {
      const p = await currentPlace();
      setCoords({ latitude: p.latitude, longitude: p.longitude });
      if (p.village) setValue('village', p.village);
      if (p.district) setValue('district', p.district);
      if (p.state) setValue('state', p.state);
      setNotice({ tone: 'success', key: 'farmForm.locationSaved' });
    } catch (e) {
      setNotice({ tone: 'warning', key: e instanceof LocationDeniedError ? 'profileSetup.locationDenied' : 'profileSetup.locationFailed' });
    } finally { setLocating(false); }
  };

  const onSubmit = handleSubmit(async (input) => {
    setNotice(null);
    try {
      const farm = await create.mutateAsync({ input, photo: photos[0], coords });
      router.replace(`/agriculture/farms/${farm.id}`);
    } catch (e) { setNotice({ tone: 'error', key: toErrorKey(e) }); }
  });

  const field = (name: 'name' | 'area_acres' | 'village' | 'district' | 'state' | 'notes', label: string, extra: object = {}) => (
    <Controller control={control} name={name} render={({ field: f }) => (
      <TextField label={label} value={f.value} onChangeText={f.onChange} onBlur={f.onBlur} error={err(errors[name])} {...extra} />
    )} />
  );

  return (
    <Screen footer={<Button testID="farm-save" label={t('farmForm.save')} iconLeft="check" loading={create.isPending} onPress={onSubmit} />}>
      <Header />
      <View style={{ gap: 6 }}>
        <AppText variant="display" accessibilityRole="header">{t('farmForm.title')}</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('farmForm.subtitle')}</AppText>
      </View>
      {field('name', t('farmForm.name'), { required: true, icon: 'landscape', placeholder: t('farmForm.namePlaceholder'), testID: 'farm-name' })}
      <Controller control={control} name="farm_type" render={({ field: f }) => (
        <ChoiceChips label={t('farmForm.type')} value={f.value} onChange={f.onChange} options={TYPES.map((v) => ({ value: v, label: t(`farmForm.types.${v}`) }))} />
      )} />
      {field('area_acres', t('farmForm.area'), { icon: 'square-foot', keyboardType: 'decimal-pad' })}
      <Controller control={control} name="soil_type" render={({ field: f }) => (
        <ChoiceChips scroll label={t('farmForm.soil')} value={f.value || null} onChange={f.onChange} options={SOIL_TYPES.map((v) => ({ value: v, label: t(`farmForm.soils.${v}`) }))} />
      )} />
      <Controller control={control} name="irrigation_source" render={({ field: f }) => (
        <ChoiceChips scroll label={t('farmForm.irrigation')} value={f.value || null} onChange={f.onChange} options={IRRIGATION.map((v) => ({ value: v, label: t(`farmForm.water.${v}`) }))} />
      )} />
      <Button variant="tonal" iconLeft="my-location" label={t('farmForm.useLocation')} loading={locating} onPress={locate} />
      {field('village', t('farmForm.village'), { icon: 'home-work' })}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>{field('district', t('farmForm.district'))}</View>
        <View style={{ flex: 1 }}>{field('state', t('farmForm.state'))}</View>
      </View>
      <PhotoPicker label={t('farmForm.photo')} value={photos} onChange={setPhotos} />
      {field('notes', t('farmForm.notes'), { multiline: true, style: { minHeight: 80, textAlignVertical: 'top' } })}
      {notice && <Banner tone={notice.tone} message={t(notice.key)} onDismiss={() => setNotice(null)} />}
    </Screen>
  );
}
