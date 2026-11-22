// 35 · Notifications Centre
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, EmptyState, ErrorState, Header, Icon, LoadingList, Screen } from '@/components';
import { CATEGORY_ICON, useMarkRead, useNotifications } from '@/features/notifications/api';
import { colors, radius } from '@/theme';

export default function NotificationsCentre() {
  const { t, i18n } = useTranslation();
  const list = useNotifications();
  const mark = useMarkRead();
  const unread = (list.data ?? []).filter((n) => !n.read_at);
  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <Screen>
      <Header title={t('notifications.title')} right={unread.length ? <Button compact variant="text" iconLeft="done-all" label={t('notifications.markAll')} loading={mark.isPending} onPress={() => mark.mutate(unread.map((n) => n.id))} /> : undefined} />
      {list.isLoading ? <LoadingList height={72} /> : list.error && !list.data ? <ErrorState onRetry={() => list.refetch()} /> : !list.data?.length ? (
        <EmptyState icon="notifications-none" title={t('notifications.empty')} />
      ) : list.data.map((n) => (
        <Card key={n.id} onPress={() => router.push(`/notifications/${n.id}`)} accessibilityLabel={`${n.read_at ? '' : `${t('notifications.new')}: `}${n.title}`}
          style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: n.read_at ? colors.surface : '#F1FAF4' }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={CATEGORY_ICON[n.category] ?? 'notifications'} color={n.priority === 'high' ? colors.error : colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="labelLg" numberOfLines={1}>{n.title}</AppText>
            {!!n.body && <AppText variant="bodySm" color={colors.textMuted} numberOfLines={2}>{n.body}</AppText>}
            <AppText variant="labelSm" color={colors.textSubtle}>{when(n.scheduled_for ?? n.created_at)}</AppText>
          </View>
          {!n.read_at && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.secondary, marginTop: 6 }} />}
        </Card>
      ))}
    </Screen>
  );
}
