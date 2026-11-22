// 06 · Registration — Stitch: 04_farmer_registration_screen_1
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  AppText, Banner, Button, Checkbox, Chip, Header, Icon, LanguageSegment, Screen, SectorPicker, StepHeader, TextField,
} from '@/components';
import { registerSchema, RegisterInput } from '@/features/auth/schemas';
import { register, toErrorKey } from '@/features/auth/api';
import { useOtpFlow } from '@/features/auth/useOtpFlow';
import { useLanguage } from '@/hooks/useLanguage';
import { isSupabaseConfigured } from '@/lib/env';
import { usePreferences } from '@/store/preferences';
import { colors, radius } from '@/theme';

export default function Register() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const setFlow = useOtpFlow((s) => s.set);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', mobile: '', email: '', password: '', confirmPassword: '', sectors: ['agriculture'], acceptTerms: false as unknown as true },
  });
  const err = (k?: { message?: string }) => (k?.message ? t(k.message) : undefined);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const parsed = registerSchema.parse(v);
      const { channel, needsOtp } = await register({ ...parsed, language });
      usePreferences.getState().setOnboardingDone();
      if (needsOtp) {
        setFlow({ mode: 'signup', channel });
        router.push('/auth/otp');
      } else {
        router.replace('/auth/profile-setup');
      }
    } catch (e) {
      setError(toErrorKey(e));
    }
  });

  return (
    <Screen>
      <Header title="AgriAqua 360" />
      <StepHeader step={t('register.step')} label={t('register.stepLabel')} progress={0.5} />
      <View style={{ gap: 6 }}>
        <AppText variant="display" accessibilityRole="header">{t('register.title')}</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('register.subtitle')}</AppText>
      </View>
      {!isSupabaseConfigured && <Banner tone="error" message={t('errors.notConfigured')} />}

      <View style={styles.langBox}>
        <View style={styles.inline}>
          <Icon name="translate" size={20} color={colors.textMuted} />
          <AppText variant="labelLg">{t('register.language')}</AppText>
        </View>
        <LanguageSegment />
      </View>

      <Controller control={control} name="fullName" render={({ field }) => (
        <TextField testID="reg-name" label={t('register.fullName')} required icon="person-outline" placeholder={t('register.fullNamePlaceholder')}
          autoComplete="name" textContentType="name" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={err(errors.fullName)} />
      )} />
      <Controller control={control} name="mobile" render={({ field }) => (
        <TextField testID="reg-mobile" label={t('register.mobile')} required icon="smartphone"
          prefix={<AppText variant="bodyLg">+91</AppText>} placeholder="98765 43210" keyboardType="phone-pad" maxLength={14}
          autoComplete="tel" textContentType="telephoneNumber" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={err(errors.mobile)} />
      )} />
      <Controller control={control} name="email" render={({ field }) => (
        <TextField testID="reg-email" label={t('register.email')} icon="mail-outline" placeholder={t('register.emailPlaceholder')}
          labelAside={<Chip label={t('common.optional')} />} hint={t('register.emailHint')}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress"
          value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={err(errors.email)} />
      )} />
      <Controller control={control} name="password" render={({ field }) => (
        <TextField testID="reg-password" label={t('register.password')} required icon="lock-outline" secureToggle placeholder={t('register.passwordPlaceholder')}
          autoCapitalize="none" autoComplete="new-password" textContentType="newPassword"
          value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={err(errors.password)} />
      )} />
      <Controller control={control} name="confirmPassword" render={({ field }) => (
        <TextField testID="reg-confirm" label={t('register.confirmPassword')} required icon="lock-reset" secureToggle placeholder={t('register.confirmPlaceholder')}
          autoCapitalize="none" autoComplete="new-password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={err(errors.confirmPassword)} />
      )} />

      <View style={[styles.inline, { justifyContent: 'space-between', marginTop: 8 }]}>
        <AppText variant="headlineSm" style={{ flex: 1 }}>{t('register.sectorsTitle')}</AppText>
        <Chip label={t('register.multiSelect')} />
      </View>
      <AppText variant="bodyMd" color={colors.textMuted}>{t('register.sectorsSubtitle')}</AppText>
      <Controller control={control} name="sectors" render={({ field }) => (
        <SectorPicker value={field.value} onChange={field.onChange} />
      )} />
      {errors.sectors && <AppText variant="bodySm" color={colors.error}>{err(errors.sectors)}</AppText>}
      <Banner tone="ai" message={t('register.aiNote')} />

      <Controller control={control} name="acceptTerms" render={({ field }) => (
        <Checkbox checked={!!field.value} onChange={field.onChange} label={t('register.terms')}>
          <AppText variant="bodyMd">{t('register.terms')}</AppText>
        </Checkbox>
      )} />
      {errors.acceptTerms && <AppText variant="bodySm" color={colors.error}>{err(errors.acceptTerms)}</AppText>}

      {error && <Banner tone="error" message={t(error)} />}
      <Button testID="reg-submit" label={t('register.submit')} icon="arrow-forward" loading={isSubmitting} onPress={onSubmit} />
      <View style={[styles.inline, { justifyContent: 'center' }]}>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('register.haveAccount')}</AppText>
        <Pressable accessibilityRole="link" hitSlop={12} onPress={() => router.replace('/auth/login')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="labelLg" color={colors.primary}>{t('register.login')}</AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langBox: { gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.surfaceLow },
});
