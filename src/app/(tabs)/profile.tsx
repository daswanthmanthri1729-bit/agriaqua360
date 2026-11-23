// 39 · Profile and Settings
import { useEffect, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Banner, Button, Card, Icon, IconName, LanguageSegment, LogoMark, SectionHeader, StorageImage, TextField } from '@/components';
import { signOut, toErrorKey } from '@/features/auth/api';
import { supabase } from '@/lib/supabase';
import { PermissionDeniedError, pickImages, uploadImage } from '@/services/media';
import { ensureNotificationChannel } from '@/services/permissions';
import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { colors, radius, space } from '@/theme';

export default function Profile() {
  const { t } = useTranslation();
  const profile = useSession((s) => s.profile);
  const session = useSession((s) => s.session);
  const weatherPlace = usePreferences((s) => s.weatherPlace);
  const setWeatherPlace = usePreferences((s) => s.setWeatherPlace);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: '', village: '', district: '', state: '' });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error' | 'warning'; key: string } | null>(null);
  const [notif, setNotif] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  const readNotif = () => Notifications.getPermissionsAsync().then((p) => setNotif(p.granted ? 'granted' : p.canAskAgain === false ? 'denied' : 'undetermined')).catch(() => {});
  useEffect(() => {
    readNotif();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && readNotif()); // returning from phone settings
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name ?? '', village: profile.village ?? '', district: profile.district ?? '', state: profile.state ?? '' });
  }, [profile]);

  const save = async () => {
    if (form.full_name.trim().length < 2) { setNotice({ tone: 'error', key: 'validation.nameMin' }); return; }
    setBusy(true); setNotice(null);
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name.trim().slice(0, 80), village: form.village.trim() || null, district: form.district.trim() || null, state: form.state.trim() || null,
    }).eq('id', session!.user.id);
    setBusy(false);
    if (error) { setNotice({ tone: 'error', key: toErrorKey(error) }); return; }
    await useSession.getState().refreshProfile();
    setEditing(false); setNotice({ tone: 'success', key: 'profile.saved' });
  };

  const changePhoto = async () => {
    try {
      const [img] = await pickImages('library', { square: true });
      if (!img) return;
      const path = await uploadImage('avatars', 'profiles', session!.user.id, img);
      await supabase.from('profiles').update({ avatar_path: path }).eq('id', session!.user.id);
      await useSession.getState().refreshProfile();
    } catch (e) {
      setNotice({ tone: 'warning', key: e instanceof PermissionDeniedError ? 'profileSetup.photoPermission' : 'profile.photoFailed' });
    }
  };

  const enableNotif = async () => {
    if (notif === 'denied') { Linking.openSettings(); return; }
    await ensureNotificationChannel().catch(() => {});
    await Notifications.requestPermissionsAsync().catch(() => null);
    readNotif();
  };

  const confirmSignOut = () => Alert.alert(t('home.signOut'), undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('home.signOut'), style: 'destructive', onPress: async () => { await signOut(); router.replace('/auth/login'); } },
  ]);

  const link = (icon: IconName, label: string, href: string) => (
    <Pressable key={href} accessibilityRole="button" onPress={() => router.push(href as never)} style={({ pressed }) => [styles.link, pressed && { backgroundColor: colors.surfaceLow }]}>
      <Icon name={icon} color={colors.primary} />
      <AppText variant="bodyLg" style={{ flex: 1 }}>{label}</AppText>
      <Icon name="chevron-right" color={colors.textSubtle} />
    </Pressable>
  );
  const field = (k: keyof typeof form, label: string) => (
    <TextField key={k} label={label} value={form[k]} onChangeText={(v) => setForm({ ...form, [k]: v })} maxLength={80} />
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <LogoMark size={40} />
          <AppText variant="display" accessibilityRole="header" style={{ flex: 1 }}>{t('profile.title')}</AppText>
        </View>
        <Card style={{ gap: 14 }}>
          <View style={styles.row}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('profile.changePhoto')} onPress={changePhoto}>
              <StorageImage path={profile?.avatar_path} bucket="avatars" fallback="person" style={styles.avatar} />
              <View style={styles.cam}><Icon name="photo-camera" size={14} color={colors.white} /></View>
            </Pressable>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="headlineSm">{profile?.full_name ?? '—'}</AppText>
              {!!profile?.phone && <AppText variant="bodyMd" color={colors.textMuted}>{profile.phone}</AppText>}
              {!!profile?.email && <AppText variant="bodyMd" color={colors.textMuted}>{profile.email}</AppText>}
              <AppText variant="bodySm" color={colors.textSubtle}>{[profile?.village, profile?.district, profile?.state].filter(Boolean).join(', ')}</AppText>
            </View>
          </View>
          {editing ? (
            <>
              {field('full_name', t('profile.name'))}
              {field('village', t('profileSetup.village'))}
              {field('district', t('profileSetup.district'))}
              {field('state', t('profileSetup.state'))}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button style={{ flex: 1 }} variant="text" label={t('common.cancel')} onPress={() => setEditing(false)} />
                <Button testID="profile-save" style={{ flex: 1 }} label={t('profile.save')} loading={busy} onPress={save} />
              </View>
            </>
          ) : <Button testID="profile-edit" variant="secondary" iconLeft="edit" label={t('profile.edit')} onPress={() => setEditing(true)} />}
        </Card>
        {notice && <Banner tone={notice.tone} message={t(notice.key)} onDismiss={() => setNotice(null)} />}

        <SectionHeader title={t('profile.language')} />
        <LanguageSegment />

        <SectionHeader title={t('profile.notifications')} />
        <Card style={{ ...styles.row, justifyContent: 'space-between' }}>
          <AppText variant="bodyMd" style={{ flex: 1 }}>{notif === 'granted' ? t('profile.notifOn') : t('profile.notifOff')}</AppText>
          {notif !== 'granted' && <Button compact variant="secondary" label={notif === 'denied' ? t('profile.openSettings') : t('profile.turnOn')} onPress={enableNotif} />}
        </Card>

        <SectionHeader title={t('profile.weather')} />
        <Card style={{ ...styles.row, justifyContent: 'space-between' }}>
          <AppText variant="bodyMd" style={{ flex: 1 }}>
            {weatherPlace ? t('profile.weatherManual', { place: 'city' in weatherPlace ? weatherPlace.city.replace(/,IN$/, '') : `${weatherPlace.lat.toFixed(2)}, ${weatherPlace.lon.toFixed(2)}` }) : t('profile.weatherAuto')}
          </AppText>
          {weatherPlace && <Button compact variant="text" label={t('profile.resetWeather')} onPress={() => setWeatherPlace(null)} />}
        </Card>

        <SectionHeader title={t('profile.more')} />
        <Card style={{ paddingVertical: 4 }}>
          {link('notifications', t('notifications.title'), '/notifications')}
          {link('tune', t('settings.notifications'), '/settings/notifications')}
          {link('bookmark', t('saved.title'), '/records/saved')}
          {link('insert-chart-outlined', t('reports.title'), '/reports')}
          {link('verified-user', t('profile.permissions'), '/onboarding/permissions')}
          {link('help-outline', t('help.title'), '/help')}
        </Card>
        <Button testID="sign-out" variant="danger" iconLeft="logout" label={t('home.signOut')} onPress={confirmSignOut} />
        <AppText variant="bodySm" color={colors.textSubtle} align="center">{t('profile.privacy')}</AppText>
        <AppText variant="labelSm" color={colors.textSubtle} align="center">AgriAqua 360 · {t('profile.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}</AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  cam: { position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, borderRadius: radius.md, paddingHorizontal: 4 },
});
