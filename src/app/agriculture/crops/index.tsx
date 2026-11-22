// 13 · Crop Management — Stitch: 16_crop_library_screen_1
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, Card, Chip, ChoiceChips, EmptyState, ErrorState, Header, LoadingList, StorageImage } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { CROP_STATUS } from '@/features/agriculture/schemas';
import { daysBetween, today } from '@/lib/dates';
import { colors, radius, space } from '@/theme';

type Filter = 'all' | (typeof CROP_STATUS)[number];

export default function CropManagement() {
  const { t } = useTranslation();
  const crops = useCrops();
  const [filter, setFilter] = useState<Filter>('all');
  const list = (crops.data ?? []).filter((c) => filter === 'all' || c.status === filter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <FlatList
        data={crops.isLoading || (crops.error && !crops.data) ? [] : list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space.md, gap: 12, paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: 4 }}>
            <Header title={t('crops.title')} />
            <ChoiceChips scroll value={filter} onChange={setFilter}
              options={[{ value: 'all', label: t('crops.all') }, ...CROP_STATUS.map((s) => ({ value: s, label: t(`crops.statuses.${s}`) }))]} />
          </View>
        }
        renderItem={({ item: c }) => {
          const day = c.sowing_date ? daysBetween(c.sowing_date, today()) : null;
          return (
            <Card onPress={() => router.push(`/agriculture/crops/${c.id}`)} accessibilityLabel={c.name} style={styles.row}>
              <StorageImage path={c.photo_path} style={styles.thumb} fallback="eco" />
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="headlineSm" numberOfLines={1}>{c.name}{c.variety ? ` (${c.variety})` : ''}</AppText>
                <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                  {[c.farm?.name, c.season && t(`crops.seasons.${c.season}`)].filter(Boolean).join(' • ')}
                </AppText>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Chip label={t(`crops.statuses.${c.status}`)} tone={c.status === 'failed' ? 'error' : 'normal'} />
                  {day != null && day >= 0 && c.status === 'growing' && <Chip tone="ai" label={t('crops.daysSinceSowing', { count: day })} />}
                </View>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          crops.isLoading ? <LoadingList height={96} /> : crops.error && !crops.data ? <ErrorState onRetry={() => crops.refetch()} /> : (
            <EmptyState icon="eco" title={t('crops.emptyTitle')} text={t('crops.emptyText')} action={t('crops.add')} onAction={() => router.push('/agriculture/crops/new')} />
          )
        }
      />
      {!!crops.data?.length && <View style={styles.fab}><Button label={t('crops.add')} iconLeft="add" onPress={() => router.push('/agriculture/crops/new')} /></View>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12 },
  thumb: { width: 72, height: 72, borderRadius: radius.lg },
  fab: { position: 'absolute', right: space.md, bottom: space.lg },
});
