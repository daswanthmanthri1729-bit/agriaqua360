// Notification preferences — which alert types reach this farmer (server push + in-app list honour these).
import { Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, ErrorState, Header, Icon, LoadingList, Screen } from '@/components';
import { CATEGORY_ICON, PREF_CATEGORIES, useNotifyPrefs, useSaveNotifyPrefs } from '@/features/notifications/api';
import { colors } from '@/theme';

export default function NotificationSettings() {
  const { t } = useTranslation();
  const q = useNotifyPrefs();
  const save = useSaveNotifyPrefs();
  if (q.isLoading) return <Screen><Header title={t('settings.notifications')} /><LoadingList /></Screen>;
  if (q.error && !q.data) return <Screen><Header title={t('settings.notifications')} /><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const prefs = q.data ?? {};
  return (
    <Screen>
      <Header title={t('settings.notifications')} />
      <AppText variant="bodyMd" color={colors.textMuted}>{t('settings.notifyHelp')}</AppText>
      <Card style={{ gap: 4, paddingVertical: 6 }}>
        {PREF_CATEGORIES.map((c) => (
          <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
            <Icon name={CATEGORY_ICON[c] ?? 'notifications'} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="labelLg">{t(`settings.cat.${c}`)}</AppText>
              <AppText variant="bodySm" color={colors.textMuted}>{t(`settings.catText.${c}`)}</AppText>
            </View>
            <Switch value={prefs[c] !== false} accessibilityLabel={t(`settings.cat.${c}`)} trackColor={{ true: colors.secondary }}
              onValueChange={(on) => save.mutate({ ...prefs, [c]: on })} />
          </View>
        ))}
      </Card>
      {save.isError && <Banner tone="error" message={t('errors.generic')} />}
      <Banner message={t('settings.criticalNote')} />
    </Screen>
  );
}
