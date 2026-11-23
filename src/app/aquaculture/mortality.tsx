// Mortality & health incidents — design: fish_mortality_health_incident_management.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Button, Card, EmptyState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { useFishRecords } from '@/features/aquaculture/api';
import { pondPerformance } from '@/features/aquaculture/performance';
import { usePondPick } from '@/features/aquaculture/usePondPick';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

export default function Mortality() {
  const { t, i18n } = useTranslation();
  const { pond: pondParam } = useLocalSearchParams<{ pond?: string }>();
  const { loading, pond, picker } = usePondPick(pondParam);
  const recs = useFishRecords(pond?.id ?? '');
  const deaths = useMemo(() => (recs.data ?? []).filter((r) => r.record_type === 'mortality'), [recs.data]);
  if (loading) return <Screen><Header title={t('aquaX.mortalityTitle')} /><LoadingList /></Screen>;
  if (!pond) return <Screen><Header title={t('aquaX.mortalityTitle')} /><EmptyState icon="water" title={t('aquaX.noPond')} action={t('aquaX.addPond')} onAction={() => router.push('/aquaculture/ponds')} /></Screen>;
  const perf = pondPerformance(pond, recs.data ?? []);
  const byCause = new Map<string, number>();
  deaths.forEach((r) => byCause.set(r.cause ?? 'unknown', (byCause.get(r.cause ?? 'unknown') ?? 0) + Number(r.quantity ?? r.count ?? 0)));
  const recent = deaths.filter((r) => Date.parse(r.recorded_on) > Date.now() - 7 * 86_400_000).reduce((s, r) => s + Number(r.quantity ?? 0), 0);
  return (
    <Screen footer={<Button iconLeft="add" label={t('aquaX.logDeaths')} onPress={() => router.push(`/aquaculture/ponds/${pond.id}`)} />}>
      <Header title={t('aquaX.mortalityTitle')} />
      {picker}
      <Card style={{ flexDirection: 'row', gap: 8 }}>
        {[[t('aquaX.totalDead'), perf.dead.toLocaleString()], [t('aquaX.last7'), recent.toLocaleString()], [t('ponds.survival'), perf.survivalPct != null ? `${perf.survivalPct}%` : '—']].map(([l, v]) => (
          <View key={l} style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="labelSm" color={colors.textSubtle} align="center">{l}</AppText>
            <AppText variant="headlineSm">{v}</AppText>
          </View>
        ))}
      </Card>
      {perf.stocked > 0 && recent / perf.stocked > 0.01 && <Banner tone="error" message={t('aquaX.highMortality')} />}
      {byCause.size > 0 && (
        <>
          <SectionHeader title={t('aquaX.byCause')} />
          <Card><BarChart bars={[...byCause.entries()].map(([c, v]) => ({ label: t(`ponds.causes.${c}`).slice(0, 9), value: v, color: colors.error }))} unit="pcs" height={130} /></Card>
        </>
      )}
      <SectionHeader title={t('aquaX.incidents')} />
      {deaths.length ? deaths.map((r) => (
        <Card key={r.id} style={{ gap: 2 }}>
          <AppText variant="labelLg">{formatDate(r.recorded_on, i18n.language)} · {r.quantity ?? '—'} {t('ponds.units.pcs')}</AppText>
          <AppText variant="bodySm" color={colors.textMuted}>{[r.cause && t(`ponds.causes.${r.cause}`), r.notes].filter(Boolean).join(' · ')}</AppText>
        </Card>
      )) : <EmptyState icon="verified" title={t('aquaX.noDeaths')} />}
      <Button variant="ai" iconLeft="set-meal" label={t('aqua.scanFish')} onPress={() => router.push({ pathname: '/aquaculture/fish-scan', params: { pondId: pond.id } })} />
    </Screen>
  );
}
