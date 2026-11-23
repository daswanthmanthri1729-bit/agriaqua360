// 10 · Farm Management — Stitch: 08_my_farms_screen_1
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, Card, Chip, EmptyState, ErrorState, Icon, InfoTile, LoadingList, BackButton, HubLinks, StorageImage, TextField } from '@/components';
import { useCrops, useFarms } from '@/features/agriculture/api';
import { colors, radius, space } from '@/theme';
import type { Farm } from '@/types/database';

export default function FarmManagement() {
  const { t } = useTranslation();
  const farms = useFarms();
  const crops = useCrops();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (farms.data ?? []).filter((f) => !s || [f.name, f.village, f.district].some((v) => v?.toLowerCase().includes(s)));
  }, [farms.data, q]);
  const growing = (crops.data ?? []).filter((c) => c.status === 'growing');
  const acres = (farms.data ?? []).reduce((s, f) => s + (Number(f.area_acres) || 0), 0);

  const header = (
    <View style={{ gap: space.md }}>
      <View style={styles.titleRow}>
        <BackButton />
        <AppText variant="display" accessibilityRole="header" style={{ flex: 1 }}>{t('farms.title')}</AppText>
        <Button compact iconLeft="eco" variant="tonal" label={t('crops.title')} onPress={() => router.push('/agriculture/crops')} />
      </View>
      <Card style={{ gap: 12 }}>
        <View style={[styles.row, { gap: 8 }]}>
          <Icon name="insert-chart-outlined" size={18} color={colors.textMuted} />
          <AppText variant="labelMd" color={colors.textMuted}>{t('farms.overview').toUpperCase()}</AppText>
        </View>
        <View style={styles.row}>
          {[[t('farms.registered'), String(farms.data?.length ?? 0)], [t('farms.totalArea'), `${acres.toLocaleString()} ${t('common.acresShort')}`], [t('farms.cropsGrowing'), String(growing.length)]].map(([l, v]) => (
            <View key={l} style={styles.stat}>
              <AppText variant="labelSm" color={colors.textSubtle} numberOfLines={1}>{l}</AppText>
              <AppText variant="headlineSm">{v}</AppText>
            </View>
          ))}
        </View>
      </Card>
      <TextField label={t('farms.search')} icon="search" placeholder={t('farms.search')} value={q} onChangeText={setQ} returnKeyType="search" />
    </View>
  );

  const renderFarm = ({ item: f }: { item: Farm }) => {
    const fc = (crops.data ?? []).filter((c) => c.farm_id === f.id);
    const place = [f.village, f.district].filter(Boolean).join(', ');
    return (
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View style={styles.photo}>
          <StorageImage path={f.photo_path} style={StyleSheet.absoluteFill} fallback="landscape" label={f.name} />
          <View style={styles.shade}>
            <AppText variant="headlineMd" color={colors.white} numberOfLines={1}>{f.name}</AppText>
            {!!place && (
              <View style={styles.row}><Icon name="place" size={16} color={colors.mint} /><AppText variant="bodyMd" color={colors.white} numberOfLines={1}>{place}</AppText></View>
            )}
          </View>
          <View style={styles.badge}><Chip label={t(`farmForm.types.${f.farm_type}`)} /></View>
        </View>
        <View style={{ padding: space.md, gap: 12 }}>
          <View style={[styles.row, { flexWrap: 'wrap' }]}>
            <InfoTile icon="square-foot" label={t('farms.area')} value={f.area_acres != null ? `${f.area_acres} ${t('common.acres')}` : '—'} />
            <InfoTile icon="eco" label={t('farms.crops')} value={fc.length ? fc.map((c) => c.name).slice(0, 3).join(', ') : '—'} />
          </View>
          <Button label={t('farms.view')} icon="arrow-forward" onPress={() => router.push(`/agriculture/farms/${f.id}`)} />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <FlatList
        data={farms.isLoading || (farms.error && !farms.data) ? [] : list}
        keyExtractor={(f) => f.id}
        renderItem={renderFarm}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        ListFooterComponent={<View style={{ gap: 12, paddingTop: 8 }}>
          <AppText variant="headlineSm">{t('hub.intelligence')}</AppText>
          <HubLinks links={[
            { icon: 'eco', label: 'growth.title', href: '/agriculture/growth' }, { icon: 'agriculture', label: 'harvest.readyTitle', href: '/agriculture/harvest-readiness' },
            { icon: 'event-available', label: 'harvest.plannerTitle', href: '/agriculture/harvest-planner' }, { icon: 'scale', label: 'yield.qtyTitle', href: '/agriculture/harvest-quantity' },
            { icon: 'water-drop', label: 'irrigation.title', href: '/agriculture/irrigation' }, { icon: 'opacity', label: 'wx.waterTitle', href: '/agriculture/water-forecast' },
            { icon: 'layers', label: 'soil.title', href: '/agriculture/soil' }, { icon: 'biotech', label: 'soilTests.title', href: '/agriculture/soil-tests' },
            { icon: 'auto-awesome', label: 'soilAi.title', href: '/agriculture/soil-ai' }, { icon: 'satellite-alt', label: 'field.title', href: '/agriculture/field' },
            { icon: 'coronavirus', label: 'risk.title', href: '/agriculture/crop-risk' }, { icon: 'bug-report', label: 'pests.title', href: '/agriculture/pests' },
            { icon: 'shield', label: 'protection.title', href: '/agriculture/protection' }, { icon: 'lightbulb', label: 'planning.title', href: '/agriculture/planning' },
            { icon: 'history', label: 'seasons.title', href: '/agriculture/seasons' }, { icon: 'thunderstorm', label: 'wx.riskTitle', href: '/agriculture/weather-risk' },
            { icon: 'public', label: 'wx.climateTitle', href: '/agriculture/climate' }, { icon: 'umbrella', label: 'wx.rainTitle', href: '/agriculture/rainfall' },
          ]} />
        </View>}
        refreshControl={<RefreshControl refreshing={farms.isRefetching} onRefresh={() => { farms.refetch(); crops.refetch(); }} colors={[colors.primary]} />}
        ListEmptyComponent={
          farms.isLoading ? <LoadingList height={260} /> : farms.error && !farms.data ? <ErrorState onRetry={() => farms.refetch()} /> : q ? (
            <AppText variant="bodyMd" color={colors.textMuted} align="center">{t('farms.noMatch')}</AppText>
          ) : (
            <EmptyState icon="landscape" title={t('farms.emptyTitle')} text={t('farms.emptyText')} action={t('farms.add')} onAction={() => router.push('/agriculture/farms/new')} />
          )
        }
      />
      {!!farms.data?.length && (
        <View style={styles.fab}><Button label={t('farms.add')} iconLeft="add" onPress={() => router.push('/agriculture/farms/new')} /></View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: 100 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stat: { flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: colors.surfaceLow, gap: 2 },
  photo: { height: 170, justifyContent: 'flex-end' },
  shade: { padding: space.md, gap: 2, backgroundColor: 'rgba(0,0,0,0.38)' },
  badge: { position: 'absolute', top: 12, left: 12 },
  fab: { position: 'absolute', right: space.md, bottom: space.md },
});
