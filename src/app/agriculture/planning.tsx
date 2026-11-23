// Smart crop planning — design: smart_crop_planning. Season, soil and water facts + AI crop suggestions for the next season.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Chip, ChoiceChips, EmptyState, Header, LoadingList, Screen } from '@/components';
import { useFarms } from '@/features/agriculture/api';
import { useSoilTests } from '@/features/intel/api';
import { seasonOf } from '@/features/intel/crop';
import { InsightCard } from '@/features/intel/InsightCard';
import { colors } from '@/theme';

export default function Planning() {
  const { t } = useTranslation();
  const farms = useFarms();
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.data?.find((f) => f.id === (farmId ?? farms.data?.[0]?.id));
  const tests = useSoilTests(farm?.id ?? null);
  if (farms.isLoading) return <Screen><Header title={t('planning.title')} /><LoadingList /></Screen>;
  if (!farm) return <Screen><Header title={t('planning.title')} /><EmptyState icon="add-location-alt" title={t('soil.noFarm')} action={t('dashboard.addFarm')} onAction={() => router.push('/agriculture/farms/new')} /></Screen>;
  const next = seasonOf(((new Date().getMonth() + 2) % 12) + 1);
  return (
    <Screen>
      <Header title={t('planning.title')} />
      {(farms.data?.length ?? 0) > 1 && <ChoiceChips scroll value={farm.id} onChange={setFarmId} options={farms.data!.map((f) => ({ value: f.id, label: f.name }))} />}
      <Card style={{ gap: 8 }}>
        <AppText variant="labelLg">{t('planning.facts')}</AppText>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip icon="event" label={`${t('wx.nextSeason')}: ${t(`crops.seasons.${next}`)}`} />
          {farm.soil_type && <Chip icon="grain" label={t(`farmForm.soils.${farm.soil_type}`)} />}
          {farm.irrigation_source && <Chip icon="water-drop" label={t(`farmForm.water.${farm.irrigation_source}`)} />}
          {farm.area_acres != null && <Chip icon="square-foot" label={`${farm.area_acres} ${t('common.acresShort')}`} />}
          <Chip tone={tests.data?.length ? 'normal' : 'warning'} icon="biotech" label={tests.data?.length ? t('planning.hasTest') : t('planning.noTest')} />
        </View>
        <AppText variant="bodySm" color={colors.textMuted}>{t(`wx.seasonTip.${next}`)}</AppText>
      </Card>
      <InsightCard kind="planning" id={farm.id} title={t('planning.aiTitle')} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} variant="secondary" iconLeft="storefront" label={t('insights.tiles.market')} onPress={() => router.push('/insights/market')} />
        <Button style={{ flex: 1 }} variant="secondary" iconLeft="eco" label={t('dashboard.addCrop')} onPress={() => router.push('/agriculture/crops/new')} />
      </View>
    </Screen>
  );
}
