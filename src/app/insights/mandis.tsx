// Mandi comparison — design: mandi_comparison_price_trends. Every mandi for a commodity, sorted, with spread and 7-day change.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Card, ChoiceChips, EmptyState, Header, LoadingList, Screen, SourceBadge } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { useMarketPrices } from '@/features/intel/api';
import { commodityFor } from '@/features/intel/commodity';
import { useSession } from '@/store/session';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

const rupees = (n: number | null | undefined) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);

export default function Mandis() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ commodity?: string }>();
  const profile = useSession((s) => s.profile);
  const crops = useCrops();
  const options = useMemo(() => [...new Set([params.commodity, ...(crops.data ?? []).map((c) => commodityFor(c.name))].filter(Boolean) as string[])], [crops.data, params.commodity]);
  const [commodity, setCommodity] = useState<string | null>(params.commodity ?? null);
  const c = commodity ?? options[0] ?? 'Maize';
  const [sort, setSort] = useState<'price' | 'change'>('price');
  const q = useMarketPrices(c, profile?.state ?? null, 14);
  const list = [...(q.data?.markets ?? [])].sort((a, b) => (sort === 'price' ? (b.modal_price ?? 0) - (a.modal_price ?? 0) : (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9)));
  return (
    <Screen>
      <Header title={t('mandis.title')} />
      <ChoiceChips scroll value={c} onChange={setCommodity} options={[...new Set([c, ...options])].map((x) => ({ value: x, label: x }))} />
      <ChoiceChips value={sort} onChange={setSort} options={[{ value: 'price', label: t('mandis.byPrice') }, { value: 'change', label: t('mandis.byChange') }]} />
      {q.isLoading ? <LoadingList /> : q.data && !q.data.configured && !list.length ? <Banner tone="warning" title={t('market.notConfiguredTitle')} message={t('market.notConfigured')} /> : !list.length ? <EmptyState icon="storefront" title={t('market.noPrices', { commodity: c })} text={t('market.noPricesText')} /> : (
        <>
          <Card><BarChart bars={list.slice(0, 10).map((m) => ({ label: m.market.slice(0, 7), value: m.modal_price ?? 0, color: colors.secondary }))} unit="₹" formatY={(y) => `${Math.round(y / 100) / 10}k`} /></Card>
          <Banner message={t('market.spread', { amount: rupees((list[0].modal_price ?? 0) - Math.min(...list.map((m) => m.modal_price ?? Infinity))) })} />
          {list.map((m, i) => (
            <Card key={`${m.market}${m.district}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText variant="labelLg" style={{ width: 24 }}>{i + 1}</AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="labelLg" numberOfLines={1}>{m.market}</AppText>
                <AppText variant="bodySm" color={colors.textMuted}>{m.district} · {formatDate(m.arrival_date, i18n.language, { day: 'numeric', month: 'short' })} · {rupees(m.min_price)}–{rupees(m.max_price)}</AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText variant="labelLg">{rupees(m.modal_price)}</AppText>
                {m.change_7d != null && <AppText variant="labelSm" color={m.change_7d >= 0 ? colors.secondary : colors.error}>{m.change_7d >= 0 ? '+' : '−'}{rupees(Math.abs(m.change_7d))}</AppText>}
              </View>
            </Card>
          ))}
          <SourceBadge source="api" label="AGMARKNET · data.gov.in" />
        </>
      )}
    </Screen>
  );
}
