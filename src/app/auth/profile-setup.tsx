// 08 · Farmer Profile Setup — no Stitch frame; continues the registration step pattern.
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Image } from 'expo-image';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Header, Icon, Screen, SectorPicker, Sheet, StepHeader, TextField } from '@/components';
import { profileSetupSchema, ProfileSetupInput, Sector } from '@/features/auth/schemas';
import { toErrorKey } from '@/features/auth/api';
import { PermissionDeniedError, PickedImage, pickImages, uploadImage } from '@/services/media';
import { currentPlace, LocationDeniedError } from '@/services/location';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';

export default function ProfileSetup() {
  const { t } = useTranslation();
  const session = useSession((s) => s.session);
  const profile = useSession((s) => s.profile);
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'warning'; key: string } | null>(null);
  const [sectors, setSectors] = useState<Sector[]>(profile?.sectors?.length ? profile.sectors : ['agriculture']);
  const { control, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<ProfileSetupInput>({
    resolver: zodResolver(profileSetupSchema),
    defaultValues: {
      village: profile?.village ?? '', district: profile?.district ?? '', state: profile?.state ?? '',
      landAcres: profile?.land_acres?.toString() ?? '', experienceYears: profile?.experience_years?.toString() ?? '',
    },
  });

  if (!session) return <Redirect href="/auth/login" />;
  const userId = session.user.id;

  const choosePhoto = async (source: 'camera' | 'library') => {
    setPhotoSheet(false);
    try {
      const [img] = await pickImages(source, { square: true });
      if (img) setPhoto(img);
    } catch (e) {
      setNotice({ tone: 'warning', key: e instanceof PermissionDeniedError ? 'profileSetup.photoPermission' : 'errors.generic' });
    }
  };

  const locate = async () => {
    setLocating(true); setNotice(null);
    try {
      const p = await currentPlace();
      setCoords({ latitude: p.latitude, longitude: p.longitude });
      if (p.village) setValue('village', p.village, { shouldValidate: true });
      if (p.district) setValue('district', p.district, { shouldValidate: true });
      if (p.state) setValue('state', p.state, { shouldValidate: true });
      setNotice({ tone: 'success', key: 'profileSetup.locationFound' });
    } catch (e) {
      setNotice({ tone: 'warning', key: e instanceof LocationDeniedError ? 'profileSetup.locationDenied' : 'profileSetup.locationFailed' });
    } finally {
      setLocating(false);
    }
  };

  const onSubmit = handleSubmit(async (v) => {
    setNotice(null);
    let avatarPath: string | undefined;
    let uploadFailed = false;
    if (photo) {
      try { avatarPath = await uploadImage('avatars', 'profiles', userId, photo); } catch { uploadFailed = true; }
    }
    const { error } = await supabase.from('profiles').update({
      village: v.village.trim(), district: v.district.trim(), state: v.state.trim(),
      land_acres: v.landAcres ? Number(v.landAcres) : null,
      experience_years: v.experienceYears ? Math.round(Number(v.experienceYears)) : null,
      sectors,
      ...(coords ?? {}),
      ...(avatarPath ? { avatar_path: avatarPath } : {}),
      onboarding_completed: true,
    }).eq('id', userId);
    if (error) {
      setNotice({ tone: 'error', key: toErrorKey(error) });
      return;
    }
    await useSession.getState().refreshProfile();
    if (uploadFailed) setNotice({ tone: 'warning', key: 'profileSetup.uploadFailed' });
    router.replace('/home');
  });

  const err = (k?: { message?: string }) => (k?.message ? t(k.message) : undefined);

  return (
    <Screen>
      <Header hideBack title="AgriAqua 360" />
      <StepHeader step={t('profileSetup.step')} label={t('profileSetup.stepLabel')} progress={1} />
      <View style={{ gap: 6 }}>
        <AppText variant="display" accessibilityRole="header">{t('profileSetup.title')}</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('profileSetup.subtitle')}</AppText>
      </View>

      <View style={styles.photoRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('profileSetup.photo')} onPress={() => setPhotoSheet(true)} style={styles.avatar}>
          {photo ? <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="person" size={44} color={colors.textSubtle} />}
          <View style={styles.cam}><Icon name="photo-camera" size={16} color={colors.white} /></View>
        </Pressable>
        <View style={{ flex: 1, gap: 8 }}>
          <AppText variant="labelLg">{t('profileSetup.photo')} <AppText variant="bodySm" color={colors.textSubtle}>({t('common.optional')})</AppText></AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button compact variant="secondary" label={photo ? t('profileSetup.changePhoto') : t('profileSetup.addPhoto')} onPress={() => setPhotoSheet(true)} />
            {photo && <Button compact variant="text" label={t('profileSetup.removePhoto')} onPress={() => setPhoto(null)} />}
          </View>
        </View>
      </View>

      <Button testID="use-location" variant="tonal" iconLeft="my-location" label={locating ? t('profileSetup.locating') : t('profileSetup.useLocation')} loading={locating} onPress={locate} />
      {notice && <Banner tone={notice.tone} message={t(notice.key)} onDismiss={() => setNotice(null)} />}

      <Controller control={control} name="village" render={({ field }) => (
        <TextField testID="ps-village" label={t('profileSetup.village')} required icon="home-work" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={err(errors.village)} />
      )} />
      <View style={styles.two}>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="district" render={({ field }) => (
            <TextField testID="ps-district" label={t('profileSetup.district')} required value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={err(errors.district)} />
          )} />
        </View>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="state" render={({ field }) => (
            <TextField testID="ps-state" label={t('profileSetup.state')} required value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={err(errors.state)} />
          )} />
        </View>
      </View>
      <View style={styles.two}>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="landAcres" render={({ field }) => (
            <TextField label={t('profileSetup.landAcres')} keyboardType="decimal-pad" icon="landscape" value={field.value} onChangeText={field.onChange} error={err(errors.landAcres)} />
          )} />
        </View>
        <View style={{ flex: 1 }}>
          <Controller control={control} name="experienceYears" render={({ field }) => (
            <TextField label={t('profileSetup.experience')} keyboardType="number-pad" value={field.value} onChangeText={field.onChange} error={err(errors.experienceYears)} />
          )} />
        </View>
      </View>

      <AppText variant="headlineSm">{t('profileSetup.sectors')}</AppText>
      <SectorPicker value={sectors} onChange={(v) => v.length && setSectors(v)} />

      <Button testID="ps-submit" label={t('profileSetup.submit')} icon="arrow-forward" loading={isSubmitting} onPress={onSubmit} />

      <Sheet visible={photoSheet} onClose={() => setPhotoSheet(false)}>
        <AppText variant="headlineSm">{t('profileSetup.photo')}</AppText>
        <Button variant="tonal" iconLeft="photo-camera" label={t('profileSetup.takePhoto')} onPress={() => choosePhoto('camera')} />
        <Button variant="tonal" iconLeft="photo-library" label={t('profileSetup.chooseGallery')} onPress={() => choosePhoto('library')} />
        <Button variant="text" label={t('common.cancel')} onPress={() => setPhotoSheet(false)} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surfaceHigh, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cam: { position: 'absolute', right: 4, bottom: 4, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  two: { flexDirection: 'row', gap: 12 },
});
