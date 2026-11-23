// Health & productivity prediction — design: ai_livestock_health_productivity_prediction. Milk trend per animal + 7-day projection.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, BarChart, Card, Chip, EmptyState, Header, LoadingList, Screen, SourceBadge } from '@/components';
import { useAnimals, useHerdRecords } from '@/features/livestock/api';
import { milkTrend } from '@/features/livestock/insights';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

export default function Productivity() {
  const { t, i18n } = useTranslation();
  const animals = useAnimals(); const recs = useHerdRecords(30);
  const herdDaily = useMemo(() => {
    const m = new Map<string, number>();
    (recs.data ?? []).filter((r) => r.record_type === 'milk').forEach((r) => m.set(r.recorded_on, (m.get(r.recorded_on) ?? 0) + Number(r.value ?? 0)));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, litres]) => ({ date, litres: Math.round(litres * 10) / 10 }));
  }, [recs.data]);
  if (recs.isLoading || animals.isLoading) return <Screen><Header title={t('herd.prodTitle')} /><LoadingList /></Screen>;
  if (!herdDaily.length) return <Screen><Header title={t('herd.prodTitle')} /><EmptyState icon="water-drop" title={t('animal.noMilk')} text={t('herd.addMilkText')} action={t('livestock.allAnimals')} onAction={() => router.push('/livestock/animals')} /></Screen>;
  const herdTrend = milkTrend(herdDaily);
  const per = (animals.data ?? []).map((a) => {
    const m = new Map<string, number>();
    (recs.data ?? []).filter((r) => r.animal_id === a.id && r.record_type === 'milk').forEach((r) => m.set(r.recorded_on, (m.get(r.recorded_on) ?? 0) + Number(r.value ?? 0)));
    return { a, tr: milkTrend([...m.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([date, litres]) => ({ date, litres }))) };
  }).filter((x) => x.tr);
  return (
    <Screen>
      <Header title={t('herd.prodTitle')} />
      <Card style={{ gap: 8 }}>
        <AppText variant="labelLg">{t('herd.herdMilk')}</AppText>
        <BarChart bars={herdDaily.slice(-21).map((d) => ({ label: formatDate(d.date, i18n.language, { day: 'numeric' }), value: d.litres, color: colors.water }))} unit="L" height={130} formatY={(y) => `${Math.round(y)}`} />
        {herdTrend && <AppText variant="bodyMd">{t('herd.trendLine', { avg: herdTrend.avg, change: `${herdTrend.perDay > 0 ? '+' : ''}${herdTrend.perDay}`, next7: herdTrend.next7 })}</AppText>}
        <SourceBadge source="ai_estimate" label={t('herd.projEstimate')} />
      </Card>
      {per.map(({ a, tr }) => (
        <Card key={a.id} onPress={() => router.push(`/livestock/animals/${a.id}`)} accessibilityLabel={a.name ?? ''} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="labelLg">{a.name ?? a.tag_id}</AppText>
            <AppText variant="bodySm" color={colors.textMuted}>{t('herd.avgPerDay', { l: tr!.avg })} · {t('herd.next7', { l: tr!.next7 })}</AppText>
          </View>
          <Chip tone={tr!.perDay < -0.3 ? 'error' : tr!.perDay > 0.1 ? 'normal' : 'dark'} icon={tr!.perDay < 0 ? 'trending-down' : 'trending-up'} label={`${tr!.perDay > 0 ? '+' : ''}${tr!.perDay} L/${t('aquaX.day')}`} />
        </Card>
      ))}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('herd.dropNote')}</AppText>
    </Screen>
  );
}
