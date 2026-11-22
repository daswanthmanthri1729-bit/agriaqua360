// 05 · Login — Stitch: 03_login_screen_1
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BrandLockup, Button, Header, Icon, LanguagePills, Screen, Sheet, TextField } from '@/components';
import { loginSchema, LoginInput } from '@/features/auth/schemas';
import { recoveryChannel, signIn, startRecovery, toErrorKey } from '@/features/auth/api';
import { useOtpFlow } from '@/features/auth/useOtpFlow';
import { nextRoute } from '@/features/auth/routing';
import { isSupabaseConfigured } from '@/lib/env';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

export default function Login() {
  const { t } = useTranslation();
  const [showInfo, setShowInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema), defaultValues: { identifier: '', password: '' },
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await signIn(v.identifier, v.password);
      usePreferences.getState().setOnboardingDone();
      const profile = await useSession.getState().refreshProfile();
      const session = useSession.getState().session;
      router.replace(nextRoute({ prefs: usePreferences.getState(), session, profile }));
    } catch (e) {
      setError(toErrorKey(e));
    }
  });

  return (
    <Screen>
      <Header right={<LanguagePills />} />
      <BrandLockup />
      <View style={{ gap: 6 }}>
        <AppText variant="display" accessibilityRole="header">{t('login.title')}</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('login.subtitle')}</AppText>
      </View>
      {!isSupabaseConfigured && <Banner tone="error" message={t('errors.notConfigured')} />}
      {showInfo && <Banner title={t('login.bannerTitle')} message={t('login.bannerText')} onDismiss={() => setShowInfo(false)} />}

      <Controller control={control} name="identifier" render={({ field }) => (
        <TextField testID="login-identifier" label={t('login.identifier')} icon="smartphone" placeholder={t('login.identifierPlaceholder')}
          autoCapitalize="none" autoComplete="username" keyboardType="email-address" textContentType="username"
          value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
          error={errors.identifier && t(errors.identifier.message!)} />
      )} />
      <Controller control={control} name="password" render={({ field }) => (
        <TextField testID="login-password" label={t('login.password')} icon="lock-outline" secureToggle placeholder="••••••••"
          autoCapitalize="none" autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => onSubmit()}
          value={field.value} onChangeText={field.onChange} onBlur={field.onBlur}
          error={errors.password && t(errors.password.message!)}
          hint={t('login.passwordHint')} />
      )} />
      <View style={styles.row}>
        <View style={styles.row}>
          <Icon name="shield" size={16} color={colors.textSubtle} />
          <AppText variant="bodySm" color={colors.textSubtle}>{t('login.encrypted')}</AppText>
        </View>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={() => setForgotOpen(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="labelLg" color={colors.primary}>{t('login.forgot')}</AppText>
        </Pressable>
      </View>

      {error && <Banner tone="error" message={t(error)} />}
      <Button testID="login-submit" label={t('login.submit')} icon="arrow-forward" loading={isSubmitting} onPress={onSubmit} />

      <View style={[styles.row, { justifyContent: 'center', gap: 6 }]}>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('login.newHere')}</AppText>
        <Pressable accessibilityRole="link" hitSlop={12} onPress={() => router.push('/auth/register')} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="labelLg" color={colors.primary}>{t('login.createAccount')}</AppText>
        </Pressable>
      </View>

      <ForgotSheet visible={forgotOpen} onClose={() => setForgotOpen(false)} />
    </Screen>
  );
}

function ForgotSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const setFlow = useOtpFlow((s) => s.set);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors } } = useForm<{ identifier: string }>({
    resolver: zodResolver(loginSchema.pick({ identifier: true })), defaultValues: { identifier: '' },
  });
  const send = handleSubmit(async ({ identifier }) => {
    setBusy(true); setError(null);
    try {
      const channel = recoveryChannel(identifier);
      await startRecovery(channel);
      setFlow({ mode: 'recovery', channel });
      onClose();
      router.push('/auth/otp');
    } catch (e) { setError(toErrorKey(e)); } finally { setBusy(false); }
  });
  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('forgot.title')}</AppText>
      <AppText variant="bodyMd" color={colors.textMuted}>{t('forgot.subtitle')}</AppText>
      <Controller control={control} name="identifier" render={({ field }) => (
        <TextField label={t('login.identifier')} icon="alternate-email" autoCapitalize="none" keyboardType="email-address"
          value={field.value} onChangeText={field.onChange} error={errors.identifier && t(errors.identifier.message!)} />
      )} />
      {error && <Banner tone="error" message={t(error)} />}
      <Button label={t('forgot.sendCode')} loading={busy} onPress={send} />
      <Button label={t('common.cancel')} variant="text" onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
});
