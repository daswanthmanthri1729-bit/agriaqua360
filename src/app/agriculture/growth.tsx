// Crop growth overview — design: crop_growth_intelligence. Every growing crop with its estimated stage and progress.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, Chip, EmptyState, Header, LoadingList, Screen } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { cropTimeline } from '@/features/intel/crop';
import { formatDate, today } from '@/lib/dates';
import { colors, radius } from '@/theme';

export default function Growth() {
  const { t, i18n } = useTranslation();
  const crops = useCrops();
  if (crops.isLoading) return <Screen><Header title={t('growth.title')} /><LoadingList /></Screen>;
  const growing = (crops.data ?? []).filter((c) => c.status === 'growing');
  if (!growing.length) return <Screen><Header title={t('growth.title')} /><EmptyState icon="eco" title={t('irrigation.noCrop')} action={t('dashboard.addCrop')} onAction={() => router.push('/agriculture/crops/new')} /></Screen>;
  return (
    <Screen>
      <Header title={t('growth.title')} />
      {growing.map((c) => {
        const tl = cropTimeline(c, today());
        return (
          <Card key={c.id} onPress={() => router.push({ pathname: '/agriculture/crop-growth', params: { crop: c.id } })} accessibilityLabel={c.name} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText variant="labelLg" style={{ flex: 1 }}>{c.name}{c.variety ? ` · ${c.variety}` : ''}</AppText>
              {(c.growth_stage ?? tl?.stage) && <Chip tone={c.growth_stage ? 'normal' : 'ai'} label={t(`stage.${c.growth_stage ?? tl!.stage}`)} />}
            </View>
            {tl ? (
              <>
                <View style={{ height: 10, borderRadius: radius.full, backgroundColor: colors.surfaceHigh, overflow: 'hidden' }} accessibilityLabel={`${Math.round(tl.progress * 100)}%`}>
                  <View style={{ width: `${tl.progress * 100}%`, height: '100%', backgroundColor: colors.secondary }} />
                </View>
                <AppText variant="bodySm" color={colors.textMuted}>{t('growth.dayOf', { day: tl.days, total: tl.total })} · {t('growth.harvestOn', { date: formatDate(tl.harvest, i18n.language) })}</AppText>
              </>
            ) : <AppText variant="bodySm" color={colors.textMuted}>{t('growth.noSowing')}</AppText>}
          </Card>
        );
      })}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('growth.note')}</AppText>
    </Screen>
  );
}
