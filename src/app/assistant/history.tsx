// 34 · AI Chat History
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, EmptyState, ErrorState, Header, Icon, LoadingList, Screen } from '@/components';
import { useConversations, useDeleteConversation } from '@/features/assistant/api';
import { formatDate, isoDate } from '@/lib/dates';
import { colors } from '@/theme';

export default function ChatHistory() {
  const { t, i18n } = useTranslation();
  const convs = useConversations();
  const del = useDeleteConversation();
  const confirm = (id: string) => Alert.alert(t('history.deleteTitle'), t('history.deleteText'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.delete'), style: 'destructive', onPress: () => del.mutate(id, { onError: () => Alert.alert(t('errors.generic')) }) },
  ]);
  return (
    <Screen>
      <Header title={t('history.title')} />
      {convs.isLoading ? <LoadingList height={72} /> : convs.error ? <ErrorState onRetry={() => convs.refetch()} /> : !convs.data?.length ? (
        <EmptyState icon="forum" title={t('history.empty')} action={t('history.start')} onAction={() => router.replace('/assistant')} />
      ) : convs.data.map((c) => (
        <Card key={c.id} onPress={() => router.navigate({ pathname: '/assistant', params: { id: c.id } })} accessibilityLabel={c.title ?? ''} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="forum" color={colors.ai} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="labelLg" numberOfLines={2}>{c.title ?? '—'}</AppText>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <AppText variant="bodySm" color={colors.textMuted}>{formatDate(isoDate(new Date(c.updated_at)), i18n.language)}</AppText>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={10} onPress={() => confirm(c.id)} style={{ padding: 8 }}>
            <Icon name="delete-outline" color={colors.textMuted} />
          </Pressable>
        </Card>
      ))}
    </Screen>
  );
}
