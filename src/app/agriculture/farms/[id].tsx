// 12 · Farm Details — Stitch: 10_plot_details_screen (HTML only)
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Chip, EmptyState, ErrorState, Header, Icon, InfoTile, LoadingList, Screen, SectionHeader, StorageImage } from '@/components';
import { useCrops, useDeleteFarm, useFarm } from '@/features/agriculture/api';
import { formatDate } from '@/lib/dates';
import { colors, radius, space } from '@/theme';

export default function FarmDetails() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const farm = useFarm(id);
  const crops = useCrops(id);
  const del = useDeleteFarm();

  if (farm.isLoading) return <Screen><Header /><LoadingList count={3} height={140} /></Screen>;
  if (farm.error || !farm.data) return <Screen><Header /><ErrorState onRetry={() => farm.refetch()} /></Screen>;
  const f = farm.data;

  const confirmDelete = () =>
    Alert.alert(t('farms.deleteTitle'), t('farms.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try { await del.mutateAsync(f.id); router.back(); } catch { Alert.alert(t('errors.generic')); }
      } },
    ]);

  return (
    <Screen>
      <Header title={t('farms.details')} right={<Button compact variant="text" iconLeft="delete-outline" label={t('common.delete')} onPress={confirmDelete} loading={del.isPending} />} />
      <View style={styles.hero}>
        <StorageImage path={f.photo_path} style={StyleSheet.absoluteFill} fallback="landscape" label={f.name} />
      </View>
      <View style={{ gap: 6 }}>
        <AppText variant="display">{f.name}</AppText>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label={t(`farmForm.types.${f.farm_type}`)} />
          {f.latitude != null && <Chip icon="gps-fixed" label={`${f.latitude.toFixed(4)}, ${f.longitude?.toFixed(4)}`} />}
        </View>
      </View>
      <View style={styles.grid}>
        <InfoTile icon="square-foot" label={t('farms.area')} value={f.area_acres != null ? `${f.area_acres} ${t('common.acres')}` : '—'} />
        <InfoTile icon="layers" label={t('farms.soil')} value={f.soil_type ? t(`farmForm.soils.${f.soil_type}`) : '—'} />
        <InfoTile icon="water" label={t('farms.irrigation')} value={f.irrigation_source ? t(`farmForm.water.${f.irrigation_source}`) : '—'} />
        <InfoTile icon="place" label={t('farms.location')} value={[f.village, f.district, f.state].filter(Boolean).join(', ') || '—'} />
      </View>
      {!!f.notes && <Card><AppText variant="labelMd" color={colors.textSubtle}>{t('farms.notes')}</AppText><AppText variant="bodyMd">{f.notes}</AppText></Card>}

      <SectionHeader title={t('farms.crops')} action={t('farms.addCrop')} onAction={() => router.push({ pathname: '/agriculture/crops/new', params: { farmId: f.id } })} />
      {crops.isLoading ? <LoadingList count={2} height={72} /> : crops.data?.length ? (
        crops.data.map((c) => (
          <Card key={c.id} onPress={() => router.push(`/agriculture/crops/${c.id}`)} accessibilityLabel={c.name} style={styles.cropRow}>
            <View style={styles.cropIcon}><Icon name="eco" color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <AppText variant="headlineSm">{c.name}{c.variety ? ` · ${c.variety}` : ''}</AppText>
              <AppText variant="bodySm" color={colors.textMuted}>
                {[c.season && t(`crops.seasons.${c.season}`), c.sowing_date && `${t('crops.sown')} ${formatDate(c.sowing_date, i18n.language)}`].filter(Boolean).join(' • ')}
              </AppText>
            </View>
            <Chip label={t(`crops.statuses.${c.status}`)} tone={c.status === 'failed' ? 'error' : 'normal'} />
          </Card>
        ))
      ) : (
        <EmptyState icon="eco" title={t('farms.noCrops')} action={t('farms.addCrop')} onAction={() => router.push({ pathname: '/agriculture/crops/new', params: { farmId: f.id } })} />
      )}
      <Pressable accessibilityRole="button" onPress={() => router.push('/agriculture/weather')} style={{ minHeight: 48, justifyContent: 'center' }}>
        <AppText variant="labelLg" color={colors.primary}>{t('dashboard.viewForecast')} →</AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 190, borderRadius: radius.xl, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cropRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space.sm + 4 },
  cropIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
});
