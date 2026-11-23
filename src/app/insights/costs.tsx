// Cultivation cost tracker — design: smart_cultivation_cost_tracker. Costs per crop by category, cost per acre.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, BarChart, Button, Card, ChoiceChips, EmptyState, Header, LoadingList, Screen } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { useTransactions } from '@/features/intel/api';
import { addDays, today } from '@/lib/dates';
import { colors } from '@/theme';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function Costs() {
  const { t } = useTranslation();
  const crops = useCrops(); const tx = useTransactions(addDays(today(), -365), today());
  const [cropId, setCropId] = useState<string | null>(null);
  const withCost = (crops.data ?? []).filter((c) => (tx.data ?? []).some((x) => x.crop_id === c.id && x.kind === 'expense'));
  const crop = withCost.find((c) => c.id === cropId) ?? withCost[0];
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    (tx.data ?? []).filter((x) => x.kind === 'expense' && x.crop_id === crop?.id).forEach((x) => m.set(x.category, (m.get(x.category) ?? 0) + Number(x.amount)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [tx.data, crop]);
  if (tx.isLoading || crops.isLoading) return <Screen><Header title={t('costs.title')} /><LoadingList /></Screen>;
  if (!crop) return <Screen><Header title={t('costs.title')} /><EmptyState icon="receipt-long" title={t('costs.empty')} text={t('costs.emptyText')} action={t('finance.add')} onAction={() => router.push('/insights/finance')} /></Screen>;
  const total = cats.reduce((s, [, v]) => s + v, 0);
  return (
    <Screen footer={<Button iconLeft="add" label={t('finance.add')} onPress={() => router.push('/insights/finance')} />}>
      <Header title={t('costs.title')} />
      {withCost.length > 1 && <ChoiceChips scroll value={crop.id} onChange={setCropId} options={withCost.map((c) => ({ value: c.id, label: c.name }))} />}
      <Card style={{ flexDirection: 'row', gap: 8 }}>
        {[[t('costs.total'), rupees(total)], [t('costs.perAcre'), crop.area_acres ? rupees(total / crop.area_acres) : '—']].map(([l, v]) => (
          <View key={l} style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="labelSm" color={colors.textSubtle}>{l}</AppText>
            <AppText variant="headlineSm">{v}</AppText>
          </View>
        ))}
      </Card>
      <Card><BarChart bars={cats.map(([c, v]) => ({ label: t(`finance.cat.${c}`).slice(0, 8), value: v, color: colors.warning }))} unit="₹" formatY={(y) => (y >= 1000 ? `${Math.round(y / 100) / 10}k` : `${Math.round(y)}`)} /></Card>
      <Card style={{ gap: 6 }}>
        {cats.map(([c, v]) => (
          <View key={c} style={{ flexDirection: 'row', gap: 8 }}>
            <AppText variant="bodyMd" style={{ flex: 1 }}>{t(`finance.cat.${c}`)}</AppText>
            <AppText variant="labelLg">{rupees(v)} · {Math.round((v / total) * 100)}%</AppText>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
