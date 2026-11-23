// Cost & profitability estimator — design: production_cost_profitability_estimator.
// Recorded costs + yield estimate + price you expect → profit range and break-even price.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, ChoiceChips, EmptyState, Header, LoadingList, Screen, SourceBadge, TextField } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { useHarvests, useTransactions } from '@/features/intel/api';
import { toQuintal, yieldEstimate } from '@/features/intel/crop';
import { addDays, today } from '@/lib/dates';
import { colors } from '@/theme';

const rupees = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;

export default function Profitability() {
  const { t } = useTranslation();
  const crops = useCrops(); const tx = useTransactions(addDays(today(), -365), today()); const harvests = useHarvests();
  const list = (crops.data ?? []).filter((c) => c.status !== 'failed');
  const [cropId, setCropId] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const crop = list.find((c) => c.id === cropId) ?? list[0];
  const cost = useMemo(() => (tx.data ?? []).filter((x) => x.kind === 'expense' && x.crop_id === crop?.id).reduce((s, x) => s + Number(x.amount), 0), [tx.data, crop]);
  const history = (harvests.data ?? []).filter((h) => crop && h.crop?.name.toLowerCase() === crop.name.toLowerCase() && h.crop.area_acres).map((h) => ({ qtlPerAcre: (toQuintal(h.quantity, h.unit) ?? 0) / h.crop!.area_acres! })).filter((h) => h.qtlPerAcre > 0);
  if (crops.isLoading || tx.isLoading) return <Screen><Header title={t('profit.title')} /><LoadingList /></Screen>;
  if (!crop) return <Screen><Header title={t('profit.title')} /><EmptyState icon="eco" title={t('irrigation.noCrop')} action={t('dashboard.addCrop')} onAction={() => router.push('/agriculture/crops/new')} /></Screen>;
  const est = yieldEstimate(crop.name, crop.area_acres, history);
  const p = Number(price);
  return (
    <Screen>
      <Header title={t('profit.title')} />
      {list.length > 1 && <ChoiceChips scroll value={crop.id} onChange={setCropId} options={list.map((c) => ({ value: c.id, label: c.name }))} />}
      <Card style={{ gap: 6 }}>
        <AppText variant="labelLg">{t('profit.costs', { amount: rupees(cost) })}</AppText>
        {!cost && <AppText variant="bodySm" color={colors.warning}>{t('profit.noCosts')}</AppText>}
        <AppText variant="bodyMd">{est ? t('profit.yield', { low: est.low, high: est.high }) : t('yield.needArea')}</AppText>
        {est && <SourceBadge source={est.basis === 'own' ? 'manual' : 'model'} label={t(`yield.basis.${est.basis}`, { count: est.seasons })} />}
        {est && cost > 0 && <AppText variant="bodyLg">{t('profit.breakEven', { price: rupees(cost / est.mid) })}</AppText>}
      </Card>
      <TextField label={t('profit.expectPrice')} prefix="₹" keyboardType="number-pad" value={price} onChangeText={setPrice} hint={t('profit.priceHint')} />
      {est && p > 0 ? (
        <Card style={{ flexDirection: 'row', gap: 8 }}>
          {[[t('outlook.low'), est.low], [t('outlook.likely'), est.mid], [t('outlook.high'), est.high]].map(([l, q]) => {
            const profit = (q as number) * p - cost;
            return (
              <View key={l as string} style={{ flex: 1, alignItems: 'center' }}>
                <AppText variant="labelSm" color={colors.textSubtle}>{l as string}</AppText>
                <AppText variant="labelLg" color={profit >= 0 ? colors.secondary : colors.error}>{rupees(profit)}</AppText>
              </View>
            );
          })}
        </Card>
      ) : <Banner message={t('profit.enterPrice')} />}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('insights.disclaimer')}</AppText>
    </Screen>
  );
}
