// Harvest-time price outlook — designs: harvest_time_price_estimator_crop_outlook, ai_market_demand_supply_price_forecast,
// smart_harvest_scheduler_weather_risk_planner. A range from past seasons, never a promised price.
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Button, Card, Chip, ChoiceChips, Header, Icon, Screen, SectionHeader, SourceBadge, TextField } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { useOutlook } from '@/features/intel/api';
import { commodityFor } from '@/features/intel/commodity';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

const rupees = (n: number | undefined) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);

export default function Outlook() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ commodity?: string; cropId?: string }>();
  const profile = useSession((s) => s.profile);
  const crops = useCrops();
  const [cropId, setCropId] = useState<string | null>(params.cropId ?? null);
  const crop = crops.data?.find((c) => c.id === cropId);
  const [commodity, setCommodity] = useState(params.commodity ?? '');
  const [month, setMonth] = useState<number>(crop?.expected_harvest_date ? Number(crop.expected_harvest_date.slice(5, 7)) : ((new Date().getMonth() + 3) % 12) + 1);
  const [qty, setQty] = useState('');
  const run = useOutlook();
  const o = run.data;
  const months = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: new Date(2026, i, 1).toLocaleDateString(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`, { month: 'short' }) }));

  const pickCrop = (id: string) => {
    setCropId(id);
    const c = crops.data?.find((x) => x.id === id);
    if (c) { setCommodity(commodityFor(c.name) ?? c.name); if (c.expected_harvest_date) setMonth(Number(c.expected_harvest_date.slice(5, 7))); }
  };
  const submit = () => commodity.trim() && run.mutate({ commodity: commodity.trim(), state: profile?.state ?? '', harvest_month: month, quantity_qtl: Number(qty) || undefined, crop_id: cropId ?? undefined });

  return (
    <Screen>
      <Header title={t('outlook.title')} />
      <Banner tone="warning" message={t('outlook.disclaimer')} />
      {!!crops.data?.length && <ChoiceChips scroll label={t('outlook.crop')} value={cropId} onChange={pickCrop} options={crops.data.filter((c) => c.status !== 'harvested').map((c) => ({ value: c.id, label: c.name }))} />}
      <TextField label={t('outlook.commodity')} value={commodity} onChangeText={setCommodity} hint={t('outlook.commodityHint')} />
      <ChoiceChips scroll label={t('outlook.harvestMonth')} value={String(month)} onChange={(m) => setMonth(Number(m))} options={months} />
      <TextField label={t('outlook.quantity')} keyboardType="decimal-pad" value={qty} onChangeText={setQty} hint={t('outlook.quantityHint')} />
      <Button variant="ai" iconLeft="insights" label={t('outlook.estimate')} loading={run.isPending} onPress={submit} disabled={!commodity.trim()} />
      {run.error && <Banner tone="error" message={t(run.error.message)} />}

      {o && !o.configured && !o.enough_history && <Banner tone="warning" message={t('market.notConfigured')} />}
      {o && o.configured !== false && !o.enough_history && (
        <Banner title={t('outlook.notEnoughTitle')} message={t(o.reason === 'no_current_price' ? 'outlook.noCurrent' : 'outlook.notEnough', { years: o.years_used ?? 0 })} />
      )}
      {o?.enough_history && (
        <>
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Chip icon="query-stats" label={t('outlook.range')} />
              <Chip tone={o.uncertainty === 'low' ? 'normal' : 'warning'} label={t(`outlook.uncertainty.${o.uncertainty}`)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[[t('outlook.low'), o.price_low], [t('outlook.likely'), o.price_mid], [t('outlook.high'), o.price_high]].map(([l, v], i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center', padding: 8, borderRadius: 12, backgroundColor: i === 1 ? colors.chip : colors.surfaceLow }}>
                  <AppText variant="labelSm" color={colors.textSubtle}>{l as string}</AppText>
                  <AppText variant={i === 1 ? 'headlineSm' : 'labelLg'}>{rupees(v as number)}</AppText>
                </View>
              ))}
            </View>
            <AppText variant="bodySm" color={colors.textMuted}>{t('outlook.basis', { current: rupees(o.current_price), years: o.years_used })}</AppText>
          </Card>

          <SectionHeader title={t('outlook.pastSeasons')} />
          <Card style={{ gap: 8 }}>
            <BarChart bars={(o.scenarios ?? []).map((s) => ({ label: String(s.year), value: s.price, color: s.ratio >= 1 ? colors.secondary : colors.warning }))} unit="₹" formatY={(y) => `${Math.round(y / 100) / 10}k`} />
            <AppText variant="labelSm" color={colors.textSubtle}>{t('outlook.scenarioNote')}</AppText>
          </Card>

          {o.revenue && (
            <>
              <SectionHeader title={t('outlook.revenue', { qty: o.revenue.quantity_qtl })} />
              <Card style={{ flexDirection: 'row', gap: 8 }}>
                {[[t('outlook.low'), o.revenue.low], [t('outlook.likely'), o.revenue.mid], [t('outlook.high'), o.revenue.high]].map(([l, v]) => (
                  <View key={l as string} style={{ flex: 1, alignItems: 'center' }}>
                    <AppText variant="labelSm" color={colors.textSubtle}>{l as string}</AppText>
                    <AppText variant="labelLg">{rupees(v as number)}</AppText>
                  </View>
                ))}
              </Card>
            </>
          )}

          {o.factors && (
            <>
              <SectionHeader title={t('outlook.factors')} />
              <Card style={{ gap: 10 }}>
                <SourceBadge source="ai_estimate" />
                <AppText variant="bodyMd">{o.factors.summary}</AppText>
                {[['up', o.factors.increase_factors, 'trending-up', colors.secondary], ['down', o.factors.decrease_factors, 'trending-down', colors.error]].map(([k, list, icon, c]) => (
                  <View key={k as string} style={{ gap: 6 }}>
                    <AppText variant="labelLg">{t(`outlook.${k}`)}</AppText>
                    {(list as string[]).map((f, i) => (
                      <View key={i} style={{ flexDirection: 'row', gap: 8 }}><Icon name={icon as 'trending-up'} size={18} color={c as string} /><AppText variant="bodyMd" style={{ flex: 1 }}>{f}</AppText></View>
                    ))}
                  </View>
                ))}
              </Card>
            </>
          )}
          <SourceBadge source="api" label="AGMARKNET · data.gov.in" />
        </>
      )}
    </Screen>
  );
}
