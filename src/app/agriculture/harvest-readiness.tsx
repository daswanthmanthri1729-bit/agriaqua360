// Harvest readiness — design: ai_harvest_readiness_dashboard.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Chip, EmptyState, Header, LoadingList, Screen } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { cropTimeline } from '@/features/intel/crop';
import { formatDate, today } from '@/lib/dates';
import { colors, radius } from '@/theme';

export default function HarvestReadiness() {
  const { t, i18n } = useTranslation();
  const crops = useCrops();
  if (crops.isLoading) return <Screen><Header title={t('harvest.readyTitle')} /><LoadingList /></Screen>;
  const rows = (crops.data ?? []).filter((c) => c.status === 'growing').map((c) => ({ c, tl: cropTimeline(c, today()) })).sort((a, b) => (a.tl?.daysLeft ?? 999) - (b.tl?.daysLeft ?? 999));
  if (!rows.length) return <Screen><Header title={t('harvest.readyTitle')} /><EmptyState icon="agriculture" title={t('irrigation.noCrop')} action={t('dashboard.addCrop')} onAction={() => router.push('/agriculture/crops/new')} /></Screen>;
  return (
    <Screen>
      <Header title={t('harvest.readyTitle')} />
      {rows.map(({ c, tl }) => {
        const ready = !!tl && (tl.daysLeft <= 7 || c.growth_stage === 'maturity' || c.growth_stage === 'harvest');
        const soon = !!tl && tl.daysLeft <= 21;
        return (
          <Card key={c.id} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText variant="labelLg" style={{ flex: 1 }}>{c.name}</AppText>
              <Chip tone={ready ? 'normal' : soon ? 'warning' : 'dark'} icon={ready ? 'check-circle' : 'schedule'} label={t(ready ? 'harvest.ready' : soon ? 'harvest.soon' : 'harvest.growing')} />
            </View>
            {tl ? (
              <>
                <View style={{ height: 10, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' }}>
                  <View style={{ width: `${tl.progress * 100}%`, height: '100%', backgroundColor: ready ? colors.secondary : colors.mint }} />
                </View>
                <AppText variant="bodySm" color={colors.textMuted}>{t('harvest.daysLeft', { count: tl.daysLeft })} · {formatDate(tl.harvest, i18n.language)}</AppText>
              </>
            ) : <AppText variant="bodySm" color={colors.textMuted}>{t('growth.noSowing')}</AppText>}
            {ready && <AppText variant="bodySm">{t('harvest.checkSigns')}</AppText>}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button compact variant="secondary" iconLeft="event" label={t('harvest.planner')} onPress={() => router.push({ pathname: '/agriculture/harvest-planner', params: { crop: c.id } })} />
              <Button compact variant="text" iconLeft="trending-up" label={t('insights.tiles.outlook')} onPress={() => router.push({ pathname: '/insights/outlook', params: { cropId: c.id } })} />
            </View>
          </Card>
        );
      })}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('growth.note')}</AppText>
    </Screen>
  );
}
