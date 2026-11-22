// Market price intelligence — designs: market_price_intelligence_dashboard, mandi_comparison_price_trends.
// Information only (no buying or selling). Prices are AGMARKNET auction rates via data.gov.in.
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, EmptyState, ErrorState, Freshness, Header, LineChart, LoadingList, Screen, SectionHeader, Sheet, SourceBadge, TextField } from '@/components';
import { useCommodities, useDeletePriceAlert, useMarketPrices, usePriceAlerts, useSavePriceAlert } from '@/features/intel/api';
import { useSession } from '@/store/session';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

const rupees = (n: number | null | undefined) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);

export default function Market() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ commodity?: string }>();
  const profile = useSession((s) => s.profile);
  const [commodity, setCommodity] = useState<string | null>(params.commodity ?? null);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [scope, setScope] = useState<'state' | 'india'>(profile?.state ? 'state' : 'india');
  const [days, setDays] = useState(30);
  const [alertOpen, setAlertOpen] = useState(false);
  useEffect(() => { const h = setTimeout(() => setDebounced(search.trim()), 350); return () => clearTimeout(h); }, [search]);
  const list = useCommodities(debounced);
  const state = scope === 'state' ? profile?.state ?? null : null;
  const q = useMarketPrices(commodity, state, days);
  const alerts = usePriceAlerts();
  const delAlert = useDeletePriceAlert();
  const d = q.data;
  const top = d?.markets[0];
  const pts = useMemo(() => (d?.series ?? []).map((p) => ({ x: Date.parse(p.date), y: p.modal, lo: p.min, hi: p.max })), [d?.series]);
  const mine = (alerts.data ?? []).filter((a) => a.commodity === commodity);

  return (
    <Screen>
      <Header title={t('market.title')} />
      <TextField label={t('market.searchLabel')} icon="search" placeholder={t('market.search')} value={search} onChangeText={setSearch} />
      <ChoiceChips scroll value={commodity} onChange={(c) => { setCommodity(c); setSearch(''); }} options={(list.data?.commodities ?? []).slice(0, 20).map((c) => ({ value: c, label: c }))} />
      {!!profile?.state && <ChoiceChips value={scope} onChange={setScope} options={[{ value: 'state', label: profile.state }, { value: 'india', label: t('market.allIndia') }]} />}

      {!commodity ? <EmptyState icon="storefront" title={t('market.pick')} text={t('market.pickText')} /> : q.isLoading ? <LoadingList count={3} height={120} /> : q.error && !d ? <ErrorState message={t(q.error.message)} onRetry={() => q.refetch()} /> : d && !d.configured && !d.markets.length ? (
        <Banner tone="warning" title={t('market.notConfiguredTitle')} message={t('market.notConfigured')} />
      ) : !d?.markets.length ? <EmptyState icon="search-off" title={t('market.noPrices', { commodity })} text={t('market.noPricesText')} /> : (
        <>
          {d.warning && <Banner tone="warning" message={t(`market.${d.warning}`)} />}
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Chip icon="sell" label={t('market.modal')} />
              <AppText variant="labelMd" color={colors.textMuted} style={{ flex: 1 }}>{top!.market}, {top!.district}</AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
              <AppText variant="display">{rupees(top!.modal_price)}</AppText>
              <AppText variant="labelLg" color={colors.textMuted}>/{t('market.quintal')}</AppText>
              {top!.change_7d != null && <Chip tone={top!.change_7d >= 0 ? 'normal' : 'error'} icon={top!.change_7d >= 0 ? 'trending-up' : 'trending-down'} label={`${top!.change_7d >= 0 ? '+' : '−'}${rupees(Math.abs(top!.change_7d))} · 7d`} />}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[[t('market.min'), top!.min_price], [t('market.modal'), top!.modal_price], [t('market.max'), top!.max_price]].map(([l, v]) => (
                <View key={l as string} style={{ flex: 1 }}>
                  <AppText variant="labelSm" color={colors.textSubtle}>{l as string}</AppText>
                  <AppText variant="labelLg">{rupees(v as number)}</AppText>
                </View>
              ))}
            </View>
            <AppText variant="labelSm" color={colors.textSubtle}>{t('market.modalOn', { date: formatDate(top!.arrival_date, i18n.language) })}{top!.variety ? ` · ${top!.variety}` : ''}</AppText>
          </Card>

          <SectionHeader title={t('market.trend')} />
          <Card style={{ gap: 8 }}>
            <ChoiceChips value={String(days)} onChange={(v) => setDays(Number(v))} options={[7, 30, 90, 365].map((n) => ({ value: String(n), label: t(`range.${n === 365 ? '1y' : `${n}d`}`) }))} />
            {pts.length > 1 ? <LineChart series={[{ points: pts, label: t('market.modal') }]} unit={`₹/${t('market.quintal')}`} formatX={(x) => formatDate(new Date(x).toISOString().slice(0, 10), i18n.language, { day: 'numeric', month: 'short' })} formatY={(y) => `${Math.round(y)}`} />
              : <AppText color={colors.textMuted}>{t('market.trendSoon')}</AppText>}
            <AppText variant="labelSm" color={colors.textSubtle}>{t('market.bandNote')}</AppText>
          </Card>

          <SectionHeader title={t('market.compare', { count: d.markets.length })} />
          <Card style={{ gap: 10 }}>
            {d.markets.slice(0, 12).map((m, i) => (
              <View key={`${m.market}${m.district}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="labelLg" numberOfLines={1}>{m.market}{i === 0 ? ' ★' : ''}</AppText>
                  <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>{m.district}, {m.state} · {formatDate(m.arrival_date, i18n.language, { day: 'numeric', month: 'short' })}</AppText>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText variant="labelLg">{rupees(m.modal_price)}</AppText>
                  {m.change_7d != null && <AppText variant="labelSm" color={m.change_7d >= 0 ? colors.secondary : colors.error}>{m.change_7d >= 0 ? '+' : '−'}{rupees(Math.abs(m.change_7d))}</AppText>}
                </View>
              </View>
            ))}
            {d.markets.length > 1 && <Banner message={t('market.spread', { amount: rupees((d.markets[0].modal_price ?? 0) - Math.min(...d.markets.map((m) => m.modal_price ?? Infinity))) })} />}
          </Card>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button style={{ flex: 1 }} variant="secondary" iconLeft="notification-add" label={t('market.setAlert')} onPress={() => setAlertOpen(true)} />
            <Button style={{ flex: 1 }} variant="ai" iconLeft="trending-up" label={t('insights.tiles.outlook')} onPress={() => router.push({ pathname: '/insights/outlook', params: { commodity } })} />
          </View>
          {mine.map((a) => (
            <Card key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText variant="bodyMd" style={{ flex: 1 }}>{t(`market.alertLine.${a.direction}`, { price: rupees(a.price) })}</AppText>
              <Button compact variant="text" iconLeft="delete-outline" label={t('common.delete')} onPress={() => delAlert.mutate(a.id)} />
            </Card>
          ))}

          <Card style={{ gap: 6 }}>
            <SourceBadge source="api" label="AGMARKNET · data.gov.in" />
            <Freshness at={d.last_updated} staleAfterMin={24 * 60} />
            <AppText variant="bodySm" color={colors.textMuted}>{t('market.provenance')}</AppText>
          </Card>
        </>
      )}
      <PriceAlertSheet visible={alertOpen} onClose={() => setAlertOpen(false)} commodity={commodity} state={state} current={top?.modal_price ?? null} />
    </Screen>
  );
}

function PriceAlertSheet({ visible, onClose, commodity, state, current }: { visible: boolean; onClose: () => void; commodity: string | null; state: string | null; current: number | null }) {
  const { t } = useTranslation();
  const save = useSavePriceAlert();
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  useEffect(() => { if (visible) setPrice(current ? String(Math.round(current * 1.05)) : ''); }, [visible, current]);
  const submit = async () => {
    const p = Number(price);
    if (!commodity || !(p > 0)) return;
    try { await save.mutateAsync({ commodity, state, market: null, direction, price: p }); onClose(); } catch { Alert.alert(t('errors.generic')); }
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('market.setAlert')}</AppText>
      <AppText variant="bodySm" color={colors.textMuted}>{t('market.alertHelp', { commodity })}</AppText>
      <ChoiceChips value={direction} onChange={setDirection} options={[{ value: 'above', label: t('market.above') }, { value: 'below', label: t('market.below') }]} />
      <TextField label={`₹/${t('market.quintal')}`} keyboardType="number-pad" value={price} onChangeText={setPrice} />
      <Button label={t('common.save')} iconLeft="check" loading={save.isPending} onPress={submit} />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}
