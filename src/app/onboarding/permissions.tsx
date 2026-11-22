// 04 · Permissions Setup — no Stitch frame; built from the Intelligent Nature card + chip patterns.
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, Header, Icon, Screen } from '@/components';
import { askPermission, PERMISSIONS, PermissionKey, PermissionState, readPermission } from '@/services/permissions';
import { usePreferences } from '@/store/preferences';
import { colors, radius } from '@/theme';

export default function Permissions() {
  const { t } = useTranslation();
  const markReviewed = usePreferences((s) => s.setPermissionsReviewed);
  const [state, setState] = useState<Partial<Record<PermissionKey, PermissionState>>>({});
  const [busy, setBusy] = useState<PermissionKey | 'all' | null>(null);

  useEffect(() => {
    Promise.all(PERMISSIONS.map(async (p) => [p.key, await readPermission(p)] as const)).then((e) => setState(Object.fromEntries(e)));
  }, []);

  const ask = async (p: (typeof PERMISSIONS)[number]) => {
    setBusy(p.key);
    const s = await askPermission(p);
    setState((prev) => ({ ...prev, [p.key]: s }));
    setBusy(null);
  };
  const askAll = async () => {
    setBusy('all');
    // Sequential: Android can only show one system dialog at a time.
    for (const p of PERMISSIONS) {
      if (state[p.key] === 'granted') continue;
      const s = await askPermission(p);
      setState((prev) => ({ ...prev, [p.key]: s }));
    }
    setBusy(null);
  };
  const next = () => {
    markReviewed();
    router.push('/auth/register');
  };
  const anyDenied = Object.values(state).includes('denied');
  const allGranted = PERMISSIONS.every((p) => state[p.key] === 'granted');

  return (
    <Screen
      footer={
        <>
          {!allGranted && <Button testID="allow-all" label={t('permissions.allowAll')} iconLeft="verified-user" loading={busy === 'all'} onPress={askAll} />}
          <Button testID="permissions-continue" label={allGranted ? t('common.continue') : t('common.skip')} variant={allGranted ? 'primary' : 'tonal'} icon="arrow-forward" onPress={next} />
        </>
      }
    >
      <Header />
      <View style={{ gap: 6 }}>
        <AppText variant="display" accessibilityRole="header">{t('permissions.title')}</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('permissions.subtitle')}</AppText>
      </View>
      {PERMISSIONS.map((p) => {
        const s = state[p.key] ?? 'undetermined';
        return (
          <Card key={p.key} style={styles.row}>
            <View style={styles.icon}><Icon name={p.icon} size={26} color={colors.primaryDeep} /></View>
            <View style={{ flex: 1, gap: 4, alignItems: 'flex-start' }}>
              <AppText variant="headlineSm">{t(`permissions.${p.key}`)}</AppText>
              <AppText variant="bodySm" color={colors.textMuted}>{t(`permissions.${p.key}Desc`)}</AppText>
              {s === 'granted' ? (
                <Chip label={t('permissions.allowed')} icon="check-circle" />
              ) : s === 'denied' ? (
                <Button compact variant="text" iconLeft="settings" label={t('permissions.openSettings')} onPress={() => Linking.openSettings()} />
              ) : (
                <Button compact variant="secondary" label={t('permissions.allow')} loading={busy === p.key} onPress={() => ask(p)} />
              )}
            </View>
          </Card>
        );
      })}
      {anyDenied && <Banner tone="warning" message={t('permissions.deniedHint')} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  icon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
});
