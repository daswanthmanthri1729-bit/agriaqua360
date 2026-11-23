// Harvest quantity for all crops — design: ai_crop_yield_harvest_quantity_prediction.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, EmptyState, Header, LoadingList, Screen, SourceBadge } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { useHarvests } from '@/features/intel/api';
import { cropTimeline, toQuintal, yieldEstimate } from '@/features/intel/crop';
import { formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';

export default function HarvestQuantity() {
  const { t, i18n } = useTranslation();
  const crops = useCrops(); const harvests = useHarvests();
  const rows = useMemo(() => (crops.data ?? []).filter((c) => c.status === 'growing' || c.status === 'planned').map((c) => {
    const history = (harvests.data ?? []).filter((h) => h.crop?.name.trim().toLowerCase() === c.name.trim().toLowerCase() && h.crop?.area_acres)
      .map((h) => ({ qtlPerAcre: (toQuintal(h.quantity, h.unit) ?? 0) / h.crop!.area_acres! })).filter((h) => h.qtlPerAcre > 0);
    return { c, est: yieldEstimate(c.name, c.area_acres, history), tl: cropTimeline(c, today()) };
  }), [crops.data, harvests.data]);
  if (crops.isLoading) return <Screen><Header title={t('yield.qtyTitle')} /><LoadingList /></Screen>;
  if (!rows.length) return <Screen><Header title={t('yield.qtyTitle')} /><EmptyState icon="eco" title={t('irrigation.noCrop')} action={t('dashboard.addCrop')} onAction={() => router.push('/agriculture/crops/new')} /></Screen>;
  const total = rows.reduce((s, r) => s + (r.est?.mid ?? 0), 0);
  return (
    <Screen>
      <Header title={t('yield.qtyTitle')} />
      <Card style={{ alignItems: 'center', gap: 4 }}>
        <AppText variant="labelSm" color={colors.textSubtle}>{t('yield.totalExpected')}</AppText>
        <AppText variant="display">~{Math.round(total)} q</AppText>
      </Card>
      {rows.map(({ c, est, tl }) => (
        <Card key={c.id} onPress={() => router.push({ pathname: '/agriculture/yield', params: { crop: c.id } })} accessibilityLabel={c.name} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppText variant="labelLg" style={{ flex: 1 }}>{c.name}{c.area_acres ? ` · ${c.area_acres} ${t('common.acresShort')}` : ''}</AppText>
            <AppText variant="labelLg">{est ? `${est.low}–${est.high} q` : '—'}</AppText>
          </View>
          <AppText variant="bodySm" color={colors.textMuted}>{tl ? t('growth.harvestOn', { date: formatDate(tl.harvest, i18n.language) }) : t('growth.noSowing')}{!c.area_acres ? ` · ${t('yield.needArea')}` : ''}</AppText>
          {est && <SourceBadge source={est.basis === 'own' ? 'manual' : 'model'} label={t(`yield.basis.${est.basis}`, { count: est.seasons })} />}
        </Card>
      ))}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('yield.note')}</AppText>
    </Screen>
  );
}
