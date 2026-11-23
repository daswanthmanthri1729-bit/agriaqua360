// Feeding intelligence — design: fish_behaviour_feeding_intelligence. Feed log + feed-per-day advice from biomass and water.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Card, EmptyState, Header, InfoTile, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { useFishRecords } from '@/features/aquaculture/api';
import { feedAdvice, pondPerformance } from '@/features/aquaculture/performance';
import { usePondPick } from '@/features/aquaculture/usePondPick';
import { useLatestFor } from '@/features/iot/api';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

export default function Feeding() {
  const { t, i18n } = useTranslation();
  const { pond: pondParam } = useLocalSearchParams<{ pond?: string }>();
  const { loading, pond, picker } = usePondPick(pondParam);
  const recs = useFishRecords(pond?.id ?? '');
  const live = useLatestFor({ pondId: pond?.id });
  const feeds = useMemo(() => (recs.data ?? []).filter((r) => r.record_type === 'feeding'), [recs.data]);
  if (loading) return <Screen><Header title={t('aquaX.feedingTitle')} /><LoadingList /></Screen>;
  if (!pond) return <Screen><Header title={t('aquaX.feedingTitle')} /><EmptyState icon="water" title={t('aquaX.noPond')} action={t('aquaX.addPond')} onAction={() => router.push('/aquaculture/ponds')} /></Screen>;
  const perf = pondPerformance(pond, recs.data ?? []);
  const doNow = live.data?.find((v) => v.sensor_type === 'water_do')?.value ?? pond.latest?.dissolved_oxygen_mgl;
  const tempNow = live.data?.find((v) => v.sensor_type === 'water_temp')?.value ?? pond.latest?.temperature_c;
  const adv = feedAdvice(perf.biomassKg, perf.avgWeightG, doNow, tempNow);
  const byDay = new Map<string, number>();
  feeds.filter((r) => r.unit === 'kg').forEach((r) => byDay.set(r.recorded_on, (byDay.get(r.recorded_on) ?? 0) + Number(r.quantity ?? 0)));
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  return (
    <Screen>
      <Header title={t('aquaX.feedingTitle')} />
      {picker}
      {adv ? (
        <Card style={{ gap: 8 }}>
          <AppText variant="labelLg">{t('aquaX.feedToday')}</AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <InfoTile icon="set-meal" label={t('aquaX.perDay')} value={`${adv.kg} kg`} />
            <InfoTile icon="schedule" label={t('aquaX.perMeal')} value={`${adv.perMeal} kg × 3`} />
            <InfoTile icon="percent" label={t('aquaX.rate')} value={`${adv.pct}%`} />
          </View>
          {adv.reduced && <Banner tone="warning" message={t('aquaX.reduced')} />}
          <SourceBadge source="ai_estimate" label={t('aquaX.feedBasis', { kg: perf.biomassKg, g: perf.avgWeightG })} />
        </Card>
      ) : <Banner message={t('aquaX.needSampleFeed')} />}
      <SectionHeader title={t('aquaX.feedLog')} action={t('ponds.addRecord')} onAction={() => router.push(`/aquaculture/ponds/${pond.id}`)} />
      {days.length ? (
        <Card style={{ gap: 6 }}>
          <BarChart bars={days.map(([d, v]) => ({ label: formatDate(d, i18n.language, { day: 'numeric' }), value: v, color: colors.secondary }))} unit="kg" height={130} formatY={(y) => `${Math.round(y)}`} />
          <AppText variant="labelSm" color={colors.textSubtle}>{t('aquaX.feedTotal', { kg: perf.feedKg })}{perf.fcr != null ? ` · FCR ${perf.fcr}` : ''}</AppText>
        </Card>
      ) : <AppText variant="bodyMd" color={colors.textMuted}>{t('aquaX.noFeeds')}</AppText>}
      <Banner message={t('aquaX.feedTips')} />
    </Screen>
  );
}
