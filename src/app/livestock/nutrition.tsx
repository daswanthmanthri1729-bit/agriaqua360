// Nutrition & feed productivity — design: livestock_nutrition_feed_productivity_intelligence.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Card, EmptyState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { useAnimals, useHerdRecords } from '@/features/livestock/api';
import { feedPerLitre } from '@/features/livestock/insights';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

export default function Nutrition() {
  const { t, i18n } = useTranslation();
  const animals = useAnimals(); const recs = useHerdRecords(30);
  const data = useMemo(() => {
    const rows = recs.data ?? [];
    const feedByDay = new Map<string, number>();
    rows.filter((r) => r.record_type === 'feeding').forEach((r) => feedByDay.set(r.recorded_on, (feedByDay.get(r.recorded_on) ?? 0) + Number(r.value ?? 0)));
    const per = (animals.data ?? []).map((a) => {
      const feed = rows.filter((r) => r.animal_id === a.id && r.record_type === 'feeding').reduce((s, r) => s + Number(r.value ?? 0), 0);
      const milk = rows.filter((r) => r.animal_id === a.id && r.record_type === 'milk').reduce((s, r) => s + Number(r.value ?? 0), 0);
      const feeds = [...new Set(rows.filter((r) => r.animal_id === a.id && r.record_type === 'feeding' && r.detail).map((r) => r.detail!))];
      return { a, feed: Math.round(feed), milk: Math.round(milk), eff: feedPerLitre(feed, milk), feeds };
    }).filter((x) => x.feed || x.milk);
    return { byDay: [...feedByDay.entries()].sort(([a], [b]) => a.localeCompare(b)), per };
  }, [recs.data, animals.data]);
  if (recs.isLoading) return <Screen><Header title={t('herd.nutritionTitle')} /><LoadingList /></Screen>;
  if (!data.per.length) return <Screen><Header title={t('herd.nutritionTitle')} /><EmptyState icon="grass" title={t('herd.noFeed')} text={t('herd.noFeedText')} action={t('livestock.allAnimals')} onAction={() => router.push('/livestock/animals')} /></Screen>;
  return (
    <Screen>
      <Header title={t('herd.nutritionTitle')} />
      {data.byDay.length > 0 && (
        <Card style={{ gap: 6 }}>
          <AppText variant="labelLg">{t('herd.feedDaily')}</AppText>
          <BarChart bars={data.byDay.slice(-21).map(([d, v]) => ({ label: formatDate(d, i18n.language, { day: 'numeric' }), value: v, color: colors.secondary }))} unit="kg" height={130} formatY={(y) => `${Math.round(y)}`} />
        </Card>
      )}
      <SectionHeader title={t('herd.perAnimal')} />
      {data.per.map(({ a, feed, milk, eff, feeds }) => (
        <Card key={a.id} onPress={() => router.push(`/livestock/animals/${a.id}`)} accessibilityLabel={a.name ?? ''} style={{ gap: 4 }}>
          <AppText variant="labelLg">{a.name ?? a.tag_id} · {t(`livestock.species.${a.species}`)}</AppText>
          <AppText variant="bodySm" color={colors.textMuted}>{t('herd.feedMilk', { feed, milk })}{eff != null ? ` · ${t('herd.eff', { v: eff })}` : ''}</AppText>
          {feeds.length > 0 && <AppText variant="labelSm" color={colors.textSubtle}>{feeds.slice(0, 4).join(', ')}</AppText>}
        </Card>
      ))}
      <Banner message={t('herd.nutritionTips')} />
    </Screen>
  );
}
