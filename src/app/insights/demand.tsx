// Demand, supply & price forecast — design: ai_market_demand_supply_price_forecast.
// Recorded price momentum + seasonal outlook + AI-listed drivers. Numbers come only from AGMARKNET history.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, Header, LineChart, LoadingList, Screen, SourceBadge } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { useMarketPrices, useOutlook } from '@/features/intel/api';
import { commodityFor } from '@/features/intel/commodity';
import { useSession } from '@/store/session';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

export default function Demand() {
  const { t, i18n } = useTranslation();
  const profile = useSession((s) => s.profile);
  const crops = useCrops();
  const options = useMemo(() => [...new Set((crops.data ?? []).map((c) => commodityFor(c.name)).filter(Boolean) as string[])], [crops.data]);
  const [commodity, setCommodity] = useState<string | null>(null);
  const c = commodity ?? options[0] ?? 'Maize';
  const q = useMarketPrices(c, profile?.state ?? null, 90);
  const run = useOutlook();
  const series = q.data?.series ?? [];
  const pts = series.map((p) => ({ x: Date.parse(p.date), y: p.modal }));
  const momentum = series.length >= 14 ? Math.round(((series.at(-1)!.modal - series.at(-14)!.modal) / series.at(-14)!.modal) * 100) : null;
  const breadth = series.length ? series.at(-1)!.markets : null;
  return (
    <Screen>
      <Header title={t('demand.title')} />
      <ChoiceChips scroll value={c} onChange={setCommodity} options={[...new Set([c, ...options])].map((x) => ({ value: x, label: x }))} />
      {q.isLoading ? <LoadingList /> : q.data && !q.data.configured && !series.length ? <Banner tone="warning" message={t('market.notConfigured')} /> : !series.length ? <Banner message={t('market.trendSoon')} /> : (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {momentum != null && <Chip tone={momentum >= 0 ? 'normal' : 'error'} icon={momentum >= 0 ? 'trending-up' : 'trending-down'} label={t('demand.momentum', { pct: `${momentum > 0 ? '+' : ''}${momentum}` })} />}
            {breadth != null && <Chip tone="dark" icon="storefront" label={t('demand.mandisReporting', { count: breadth })} />}
          </View>
          <LineChart series={[{ points: pts, label: t('market.modal') }]} unit="₹" formatX={(x) => formatDate(new Date(x).toISOString().slice(0, 10), i18n.language, { day: 'numeric', month: 'short' })} formatY={(y) => `${Math.round(y)}`} />
          <AppText variant="labelSm" color={colors.textSubtle}>{t('demand.supplyNote')}</AppText>
        </Card>
      )}
      <Button variant="ai" iconLeft="insights" label={t('demand.whatNext')} loading={run.isPending} onPress={() => run.mutate({ commodity: c, state: profile?.state ?? '', harvest_month: ((new Date().getMonth() + 2) % 12) + 1 })} />
      {run.data?.factors && (
        <Card style={{ gap: 8 }}>
          <SourceBadge source="ai_estimate" />
          <AppText variant="bodyMd">{run.data.factors.summary}</AppText>
          {run.data.factors.increase_factors.map((f, i) => <AppText key={`u${i}`} variant="bodyMd" color={colors.secondary}>▲ {f}</AppText>)}
          {run.data.factors.decrease_factors.map((f, i) => <AppText key={`d${i}`} variant="bodyMd" color={colors.error}>▼ {f}</AppText>)}
        </Card>
      )}
      {run.data && !run.data.enough_history && <Banner message={t('outlook.notEnough', { years: run.data.years_used ?? 0 })} />}
      <Button variant="secondary" iconLeft="trending-up" label={t('insights.tiles.outlook')} onPress={() => router.push({ pathname: '/insights/outlook', params: { commodity: c } })} />
      <AppText variant="bodySm" color={colors.textSubtle}>{t('insights.disclaimer')}</AppText>
    </Screen>
  );
}
