// Growth & production — design: fish_growth_production_intelligence.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, EmptyState, Header, InfoTile, LineChart, LoadingList, Screen, TextField } from '@/components';
import { useFishRecords } from '@/features/aquaculture/api';
import { growthRate, pondPerformance } from '@/features/aquaculture/performance';
import { usePondPick } from '@/features/aquaculture/usePondPick';
import { addDays, formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';

export default function FishGrowth() {
  const { t, i18n } = useTranslation();
  const { pond: pondParam } = useLocalSearchParams<{ pond?: string }>();
  const { loading, pond, picker } = usePondPick(pondParam);
  const recs = useFishRecords(pond?.id ?? '');
  const [target, setTarget] = useState('');
  const samples = useMemo(() => (recs.data ?? []).filter((r) => r.record_type === 'sampling' && r.avg_weight_g != null).map((r) => ({ recorded_on: r.recorded_on, avg_weight_g: Number(r.avg_weight_g) })), [recs.data]);
  if (loading) return <Screen><Header title={t('aquaX.growthTitle')} /><LoadingList /></Screen>;
  if (!pond) return <Screen><Header title={t('aquaX.growthTitle')} /><EmptyState icon="water" title={t('aquaX.noPond')} action={t('aquaX.addPond')} onAction={() => router.push('/aquaculture/ponds')} /></Screen>;
  const g = growthRate(samples, Number(target) || undefined);
  const perf = pondPerformance(pond, recs.data ?? []);
  const pts = [...samples].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on)).map((s) => ({ x: Date.parse(s.recorded_on), y: s.avg_weight_g }));
  return (
    <Screen>
      <Header title={t('aquaX.growthTitle')} />
      {picker}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <InfoTile icon="scale" label={t('aquaX.avgWeight')} value={g ? `${g.current} g` : perf.avgWeightG ? `${perf.avgWeightG} g` : '—'} />
        <InfoTile icon="trending-up" label={t('aquaX.adg')} value={g ? `${g.adg} g/${t('aquaX.day')}` : '—'} />
        <InfoTile icon="inventory" label={t('ponds.biomass')} value={perf.biomassKg != null ? `~${perf.biomassKg} kg` : '—'} />
        <InfoTile icon="favorite" label={t('ponds.survival')} value={perf.survivalPct != null ? `${perf.survivalPct}%` : '—'} />
      </View>
      {pts.length > 1 ? (
        <Card style={{ gap: 6 }}>
          <LineChart series={[{ points: pts, color: colors.water, label: t('aquaX.avgWeight') }]} unit="g" formatX={(x) => formatDate(new Date(x).toISOString().slice(0, 10), i18n.language, { day: 'numeric', month: 'short' })} />
        </Card>
      ) : <Banner message={t('aquaX.needTwoSamples')} />}
      <Card style={{ gap: 8 }}>
        <TextField label={t('aquaX.targetWeight')} keyboardType="number-pad" value={target} onChangeText={setTarget} />
        {g?.daysToTarget != null && <AppText variant="bodyLg">{t('aquaX.reachBy', { days: g.daysToTarget, date: formatDate(addDays(today(), g.daysToTarget), i18n.language) })}</AppText>}
        <AppText variant="labelSm" color={colors.textSubtle}>{t('aquaX.growthNote')}</AppText>
      </Card>
    </Screen>
  );
}
