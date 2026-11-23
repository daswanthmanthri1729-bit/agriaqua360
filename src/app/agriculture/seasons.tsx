// Production history & season comparison — design: production_history_season_comparison.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, BarChart, Card, EmptyState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { useHarvests } from '@/features/intel/api';
import { seasonOf, toQuintal } from '@/features/intel/crop';
import { colors } from '@/theme';

export default function Seasons() {
  const { t } = useTranslation();
  const q = useHarvests();
  const groups = useMemo(() => {
    const m = new Map<string, { crop: string; season: string; year: string; qtl: number; acres: number }>();
    for (const h of q.data ?? []) {
      const qtl = toQuintal(h.quantity, h.unit);
      if (!h.crop || qtl == null || !h.scheduled_for) continue;
      const season = h.crop.season ?? seasonOf(Number(h.scheduled_for.slice(5, 7)));
      const year = h.scheduled_for.slice(0, 4);
      const k = `${h.crop.name.toLowerCase()}|${season}|${year}`;
      const g = m.get(k) ?? { crop: h.crop.name, season, year, qtl: 0, acres: 0 };
      g.qtl += qtl; g.acres += Number(h.crop.area_acres ?? 0);
      m.set(k, g);
    }
    return [...m.values()].sort((a, b) => b.year.localeCompare(a.year));
  }, [q.data]);
  if (q.isLoading) return <Screen><Header title={t('seasons.title')} /><LoadingList /></Screen>;
  if (!groups.length) return <Screen><Header title={t('seasons.title')} /><EmptyState icon="history" title={t('seasons.empty')} text={t('seasons.emptyText')} action={t('dashboard.calendar')} onAction={() => router.push('/agriculture/calendar')} /></Screen>;
  const crops = [...new Set(groups.map((g) => g.crop))];
  return (
    <Screen>
      <Header title={t('seasons.title')} />
      {crops.map((c) => {
        const gs = groups.filter((g) => g.crop === c).reverse();
        return (
          <Card key={c} style={{ gap: 8 }}>
            <AppText variant="labelLg">{c}</AppText>
            <BarChart bars={gs.map((g) => ({ label: `${t(`crops.seasons.${g.season}`).slice(0, 5)} ${g.year.slice(2)}`, value: g.acres ? Math.round((g.qtl / g.acres) * 10) / 10 : g.qtl, color: colors.secondary }))} unit={gs.some((g) => g.acres) ? 'q/acre' : 'q'} height={130} formatY={(y) => `${Math.round(y)}`} />
            {gs.length > 1 && gs.at(-1)!.acres && gs.at(-2)!.acres ? (() => {
              const a = gs.at(-1)!.qtl / gs.at(-1)!.acres, b = gs.at(-2)!.qtl / gs.at(-2)!.acres;
              return <AppText variant="bodyMd" color={a >= b ? colors.secondary : colors.error}>{t(a >= b ? 'seasons.better' : 'seasons.worse', { pct: Math.abs(Math.round(((a - b) / b) * 100)) })}</AppText>;
            })() : null}
          </Card>
        );
      })}
      <SectionHeader title={t('seasons.all')} />
      <Card style={{ gap: 6 }}>
        {groups.map((g) => (
          <View key={`${g.crop}${g.season}${g.year}`} style={{ flexDirection: 'row', gap: 8 }}>
            <AppText variant="bodyMd" style={{ flex: 1 }}>{g.crop} · {t(`crops.seasons.${g.season}`)} {g.year}</AppText>
            <AppText variant="labelLg">{Math.round(g.qtl * 10) / 10} q{g.acres ? ` (${Math.round((g.qtl / g.acres) * 10) / 10}/acre)` : ''}</AppText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
