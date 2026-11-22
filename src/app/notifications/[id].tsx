// 36 · Alert Details
import { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ErrorState, Header, Icon, LoadingList, Screen } from '@/components';
import { CATEGORY_ICON, useDeleteNotification, useMarkRead, useNotification } from '@/features/notifications/api';
import { colors } from '@/theme';

export default function AlertDetails() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const n = useNotification(id);
  const mark = useMarkRead();
  const del = useDeleteNotification();
  useEffect(() => { if (n.data && !n.data.read_at) mark.mutate([n.data.id]); }, [n.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (n.isLoading) return <Screen><Header /><LoadingList count={2} /></Screen>;
  if (!n.data) return <Screen><Header /><ErrorState onRetry={() => n.refetch()} /></Screen>;
  const a = n.data;
  const known = ['weather', 'crop', 'irrigation', 'farm', 'pond', 'vaccination', 'animal_health', 'ai', 'system'].includes(a.category);
  const remove = () => Alert.alert(t('notifications.deleteTitle'), undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: () => del.mutate(a.id, { onSuccess: () => router.back(), onError: () => Alert.alert(t('errors.generic')) }) },
  ]);
  return (
    <Screen footer={a.route ? <Button testID="alert-open" iconLeft="open-in-new" label={t('notifications.open')} onPress={() => router.push(a.route as never)} /> : undefined}>
      <Header title={t('notifications.detailsTitle')} right={<Button compact variant="text" iconLeft="delete-outline" label={t('common.delete')} onPress={remove} />} />
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name={CATEGORY_ICON[a.category] ?? 'notifications'} size={28} color={a.priority === 'high' ? colors.error : colors.primary} />
          {known && <Chip label={t(`notifications.categories.${a.category}`)} tone={a.priority === 'high' ? 'error' : 'normal'} />}
        </View>
        <AppText variant="headlineMd">{a.title}</AppText>
        {!!a.body && <AppText variant="bodyLg">{a.body}</AppText>}
        <AppText variant="bodySm" color={colors.textSubtle}>
          {t('notifications.received', { date: new Date(a.scheduled_for ?? a.created_at).toLocaleString(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`) })}
        </AppText>
      </Card>
      {!a.route && <Banner message={t('notifications.noLink')} />}
    </Screen>
  );
}
