// Farm money — designs: farm_financial_intelligence_dashboard, smart_cultivation_cost_tracker,
// production_cost_profitability_estimator, ai_farm_cost_optimization_financial_insights. Bookkeeping only.
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Button, Card, ChoiceChips, DateField, EmptyState, ErrorState, Header, Icon, LoadingList, Screen, SectionHeader, Sheet, TextField } from '@/components';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, useAddTransaction, useDeleteTransaction, useFinanceSummary, useTransactions } from '@/features/intel/api';
import { InsightCard } from '@/features/intel/InsightCard';
import { useCrops } from '@/features/agriculture/api';
import { usePonds } from '@/features/aquaculture/api';
import { useAnimals } from '@/features/livestock/api';
import { addDays, formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';
import type { TxKind } from '@/types/database';

const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const PERIODS = [{ k: 'month', days: 30 }, { k: 'quarter', days: 91 }, { k: 'year', days: 365 }];

export default function Finance() {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState(91);
  const from = addDays(today(), -days), to = today();
  const tx = useTransactions(from, to);
  const sum = useFinanceSummary(from, to);
  const crops = useCrops(); const ponds = usePonds(); const animals = useAnimals();
  const del = useDeleteTransaction();
  const [open, setOpen] = useState(false);
  const total = sum.data?.find((r) => r.scope === 'total');
  const name = (scope: string, id: string | null) =>
    scope === 'crop' ? crops.data?.find((c) => c.id === id)?.name : scope === 'pond' ? ponds.data?.find((p) => p.id === id)?.name
      : scope === 'animal' ? (animals.data?.find((a) => a.id === id)?.name ?? animals.data?.find((a) => a.id === id)?.tag_id) : t(`finance.scope.${scope}`);
  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    (tx.data ?? []).filter((x) => x.kind === 'expense').forEach((x) => m.set(x.category, (m.get(x.category) ?? 0) + Number(x.amount)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [tx.data]);

  return (
    <Screen footer={<Button label={t('finance.add')} iconLeft="add" onPress={() => setOpen(true)} testID="add-tx" />}>
      <Header title={t('finance.title')} />
      <ChoiceChips value={String(days)} onChange={(v) => setDays(Number(v))} options={PERIODS.map((p) => ({ value: String(p.days), label: t(`finance.period.${p.k}`) }))} />
      {sum.isLoading ? <LoadingList count={2} /> : sum.error && !sum.data ? <ErrorState onRetry={() => sum.refetch()} /> : !tx.data?.length ? (
        <EmptyState icon="account-balance-wallet" title={t('finance.empty')} text={t('finance.emptyText')} action={t('finance.add')} onAction={() => setOpen(true)} />
      ) : (
        <>
          <Card style={{ flexDirection: 'row', gap: 8 }}>
            {[[t('finance.income'), total?.income ?? 0, colors.secondary], [t('finance.expense'), total?.expense ?? 0, colors.error], [t('finance.profit'), total?.profit ?? 0, (total?.profit ?? 0) >= 0 ? colors.primaryDeep : colors.error]].map(([l, v, c]) => (
              <View key={l as string} style={{ flex: 1, alignItems: 'center' }}>
                <AppText variant="labelSm" color={colors.textSubtle}>{l as string}</AppText>
                <AppText variant="headlineSm" color={c as string} numberOfLines={1} adjustsFontSizeToFit>{rupees(Number(v))}</AppText>
              </View>
            ))}
          </Card>
          {!!byCat.length && (
            <>
              <SectionHeader title={t('finance.topCosts')} />
              <Card><BarChart bars={byCat.map(([c, v]) => ({ label: t(`finance.cat.${c}`).slice(0, 8), value: v, color: colors.warning }))} unit="₹" formatY={(y) => (y >= 1000 ? `${Math.round(y / 100) / 10}k` : `${Math.round(y)}`)} /></Card>
            </>
          )}
          {(sum.data ?? []).filter((r) => r.scope !== 'total' && r.scope !== 'general').length > 0 && (
            <>
              <SectionHeader title={t('finance.byScope')} />
              <Card style={{ gap: 10 }}>
                {(sum.data ?? []).filter((r) => r.scope !== 'total' && r.scope !== 'general').sort((a, b) => b.profit - a.profit).map((r) => (
                  <View key={`${r.scope}${r.scope_id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <AppText variant="labelLg" numberOfLines={1}>{name(r.scope, r.scope_id) ?? '—'}</AppText>
                      <AppText variant="bodySm" color={colors.textMuted}>{t(`finance.scope.${r.scope}`)} · {t('finance.inOut', { income: rupees(r.income), expense: rupees(r.expense) })}</AppText>
                    </View>
                    <AppText variant="labelLg" color={r.profit >= 0 ? colors.secondary : colors.error}>{r.profit >= 0 ? '+' : '−'}{rupees(Math.abs(r.profit))}</AppText>
                  </View>
                ))}
              </Card>
            </>
          )}
          <InsightCard kind="finance" id={null} />
          <SectionHeader title={t('finance.entries')} />
          <Card style={{ gap: 10 }}>
            {(tx.data ?? []).slice(0, 50).map((x) => (
              <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="labelLg">{t(`finance.cat.${x.category}`)}</AppText>
                  <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>{formatDate(x.occurred_on, i18n.language)}{x.notes ? ` · ${x.notes}` : ''}</AppText>
                </View>
                <AppText variant="labelLg" color={x.kind === 'income' ? colors.secondary : colors.text}>{x.kind === 'income' ? '+' : '−'}{rupees(Number(x.amount))}</AppText>
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={10} style={{ padding: 6 }}
                  onPress={() => Alert.alert(t('finance.deleteTitle'), '', [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: () => del.mutate(x.id) }])}>
                  <Icon name="delete-outline" color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      )}
      <TxSheet visible={open} onClose={() => setOpen(false)} />
    </Screen>
  );
}

function TxSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const add = useAddTransaction();
  const crops = useCrops(); const ponds = usePonds(); const animals = useAnimals();
  const [kind, setKind] = useState<TxKind>('expense');
  const [category, setCategory] = useState<string>('seed');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [link, setLink] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setKind('expense'); setCategory('seed'); setAmount(''); setDate(today()); setLink(null); setNotes(''); setError(null); } }, [visible]);
  const links = [
    ...(crops.data ?? []).map((c) => ({ value: `crop:${c.id}`, label: `🌾 ${c.name}` })),
    ...(ponds.data ?? []).map((p) => ({ value: `pond:${p.id}`, label: `🐟 ${p.name}` })),
    ...(animals.data ?? []).map((a) => ({ value: `animal:${a.id}`, label: `🐄 ${a.name ?? a.tag_id ?? a.species}` })),
  ];
  const save = async () => {
    const a = Number(amount.replace(/,/g, ''));
    if (!(a > 0 && a < 1e8)) { setError('finance.amountInvalid'); return; }
    const [scope, id] = link?.split(':') ?? [];
    try {
      await add.mutateAsync({ kind, category, amount: a, occurred_on: date, notes: notes.trim() || null, crop_id: scope === 'crop' ? id : null, pond_id: scope === 'pond' ? id : null, animal_id: scope === 'animal' ? id : null });
      onClose();
    } catch { setError('errors.generic'); }
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('finance.add')}</AppText>
      <ChoiceChips value={kind} onChange={(k) => { setKind(k); setCategory(k === 'expense' ? 'seed' : 'crop_sale'); }} options={[{ value: 'expense', label: t('finance.expense') }, { value: 'income', label: t('finance.income') }]} />
      <ChoiceChips scroll label={t('finance.category')} value={category} onChange={setCategory} options={(kind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => ({ value: c, label: t(`finance.cat.${c}`) }))} />
      <TextField label={t('finance.amount')} prefix="₹" required keyboardType="decimal-pad" value={amount} onChangeText={setAmount} testID="tx-amount" />
      <DateField label={t('finance.date')} value={date} onChange={setDate} />
      {!!links.length && <ChoiceChips scroll label={t('finance.linkTo')} value={link} onChange={(v) => setLink(v === link ? null : v)} options={links} />}
      <TextField label={t('finance.notes')} value={notes} onChangeText={setNotes} maxLength={300} />
      {error && <Banner tone="error" message={t(error)} />}
      <Button label={t('common.save')} iconLeft="check" loading={add.isPending} onPress={save} testID="tx-save" />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}
