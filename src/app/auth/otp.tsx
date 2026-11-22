// 07 · OTP Verification — no Stitch frame; matches login/registration layout.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Header, Icon, OtpInput, Screen, StepHeader, TextField } from '@/components';
import { completeRecovery, resendSignupOtp, startRecovery, toErrorKey, verifySignupOtp } from '@/features/auth/api';
import { resetSchema } from '@/features/auth/schemas';
import { useOtpFlow } from '@/features/auth/useOtpFlow';
import { nextRoute } from '@/features/auth/routing';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';

const RESEND_SECONDS = 60;

export default function Otp() {
  const { t } = useTranslation();
  const flow = useOtpFlow((s) => s.flow);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  if (!flow) return <Redirect href="/auth/login" />;
  const recovery = flow.mode === 'recovery';
  const target = flow.channel.kind === 'email' ? flow.channel.email : flow.channel.phone;

  const finish = async () => {
    const profile = await useSession.getState().refreshProfile();
    const session = useSession.getState().session;
    useOtpFlow.getState().set(null);
    router.replace(nextRoute({ prefs: usePreferences.getState(), session, profile }));
  };

  const submit = async () => {
    setError(null); setInfo(null); setFieldErrors({});
    if (recovery) {
      const r = resetSchema.safeParse({ code, password, confirmPassword: confirm });
      if (!r.success) {
        setFieldErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
        return;
      }
    } else if (!/^\d{6}$/.test(code)) {
      setFieldErrors({ code: 'validation.otp' });
      return;
    }
    setBusy(true);
    try {
      if (recovery) await completeRecovery(flow.channel, code, password);
      else await verifySignupOtp(flow.channel, code);
      await finish();
    } catch (e) {
      setError(toErrorKey(e));
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null); setInfo(null);
    try {
      if (recovery) await startRecovery(flow.channel);
      else await resendSignupOtp(flow.channel);
      setLeft(RESEND_SECONDS);
      setInfo('otp.resent');
    } catch (e) {
      setError(toErrorKey(e));
    }
  };

  return (
    <Screen footer={<Button testID="otp-submit" label={recovery ? t('otp.updatePassword') : t('otp.verify')} icon="verified" loading={busy} onPress={submit} />}>
      <Header />
      {!recovery && <StepHeader step={t('register.step')} label={t('register.stepLabel')} progress={0.75} />}
      <View style={styles.badge}><Icon name={flow.channel.kind === 'email' ? 'mark-email-read' : 'sms'} size={36} color={colors.primaryDeep} /></View>
      <View style={{ gap: 6 }}>
        <AppText variant="display" accessibilityRole="header">{recovery ? t('otp.recoveryTitle') : t('otp.title')}</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>
          {t(flow.channel.kind === 'email' ? 'otp.subtitleEmail' : 'otp.subtitlePhone', { target })}
        </AppText>
      </View>
      <OtpInput value={code} onChange={setCode} error={!!fieldErrors.code} label={t('otp.code')} />
      {fieldErrors.code && <AppText variant="bodySm" color={colors.error}>{t(fieldErrors.code)}</AppText>}

      {recovery && (
        <>
          <TextField label={t('otp.newPassword')} required icon="lock-outline" secureToggle autoCapitalize="none" autoComplete="new-password"
            value={password} onChangeText={setPassword} error={fieldErrors.password && t(fieldErrors.password)} />
          <TextField label={t('otp.confirmPassword')} required icon="lock-reset" secureToggle autoCapitalize="none"
            value={confirm} onChangeText={setConfirm} error={fieldErrors.confirmPassword && t(fieldErrors.confirmPassword)} />
        </>
      )}

      {error && <Banner tone="error" message={t(error)} />}
      {info && <Banner tone="success" message={t(info)} />}

      <View style={styles.center}>
        {left > 0 ? (
          <AppText variant="bodyMd" color={colors.textSubtle}>{t('otp.resendIn', { seconds: left })}</AppText>
        ) : (
          <Button compact variant="text" iconLeft="refresh" label={t('otp.resend')} onPress={resend} />
        )}
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="bodyMd" color={colors.primary}>{t('otp.wrongTarget')}</AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { width: 72, height: 72, borderRadius: radius.xl, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', gap: 4 },
});
