// 37 · Saved Farming Records
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, ChoiceChips, EmptyState, ErrorState, Header, Icon, IconName, LoadingList, Screen } from '@/components';
import { savedRoute, SavedRecord, useRemoveSaved, useSaved } from '@/features/notifications/saved';
import { formatDate, isoDate } from '@/lib/dates';
import { colors, radius } from '@/theme';

const TYPES = ['disease_report', 'fish_health_report', 'ai_message'] as const;
const ICON: Record<string, IconName> = { disease_report: 'eco', fish_health_report: 'set-meal', ai_message: 'auto-awesome' };

export default function SavedRecords() {
  const { t, i18n } = useTranslation();
  const saved = useSaved();
  const remove = useRemoveSaved();
  const [type, setType] = useState<'all' | (typeof TYPES)[number]>('all');
  const list = (saved.data ?? []).filter((r) => type === 'all' || r.record_type === type);

  const open = async (r: SavedRecord) => {
    const route = await savedRoute(r).catch(() => null);
    route ? router.push(route as never) : Alert.alert(t('saved.notFound'));
  };
  const confirm = (r: SavedRecord) => Alert.alert(t('saved.removeTitle'), r.title ?? undefined, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('common.remove'), style: 'destructive', onPress: () => remove.mutate(r.id, { onError: () => Alert.alert(t('errors.generic')) }) },
  ]);

  return (
    <Screen>
      <Header title={t('saved.title')} />
      <ChoiceChips scroll value={type} onChange={setType} options={[{ value: 'all', label: t('saved.all') }, ...TYPES.map((x) => ({ value: x, label: t(`saved.types.${x}`) }))]} />
      {saved.isLoading ? <LoadingList height={72} /> : saved.error && !saved.data ? <ErrorState onRetry={() => saved.refetch()} /> : !list.length ? (
        <EmptyState icon="bookmark-border" title={t('saved.empty')} />
      ) : list.map((r) => (
        <Card key={r.id} onPress={() => open(r)} accessibilityLabel={r.title ?? ''} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={ICON[r.record_type] ?? 'bookmark'} color={colors.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="labelLg" numberOfLines={2}>{r.title || '—'}</AppText>
            <AppText variant="bodySm" color={colors.textMuted}>
              {(TYPES as readonly string[]).includes(r.record_type) ? t(`saved.types.${r.record_type}`) : ''} • {formatDate(isoDate(new Date(r.created_at)), i18n.language)}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.remove')} hitSlop={10} onPress={() => confirm(r)} style={{ padding: 8 }}>
            <Icon name="bookmark-remove" color={colors.textMuted} />
          </Pressable>
        </Card>
      ))}
    </Screen>
  );
}
