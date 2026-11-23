// Farm performance analytics — design: unified_farm_performance_analytics.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, ChoiceChips, Header, InfoTile, LoadingList, Screen, SectionHeader } from '@/components';
import { useFinanceSummary, useHarvests } from '@/features/intel/api';
import { toQuintal } from '@/features/intel/crop';
import { useHerdRecords } from '@/features/livestock/api';
import { useReport } from '@/features/reports/api';
import { addDays, today } from '@/lib/dates';
import { colors } from '@/theme';

const rupees = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;

export default function Performance() {
  const { t } = useTranslation();
  const [days, setDays] = useState(90);
  const r = useReport(days); const fin = useFinanceSummary(addDays(today(), -days), today()); const h = useHarvests(); const milk = useHerdRecords(days);
  const total = fin.data?.find((x) => x.scope === 'total');
  const harvested = (h.data ?? []).filter((x) => (x.scheduled_for ?? '') >= addDays(today(), -days)).reduce((s, x) => s + (toQuintal(x.quantity, x.unit) ?? 0), 0);
  const milkL = (milk.data ?? []).filter((x) => x.record_type === 'milk').reduce((s, x) => s + Number(x.value ?? 0), 0);
  return (
    <Screen>
      <Header title={t('perf.title')} />
      <ChoiceChips value={String(days)} onChange={(v) => setDays(Number(v))} options={[30, 90, 365].map((n) => ({ value: String(n), label: t(`range.${n === 365 ? '1y' : `${n}d`}`) }))} />
      {r.isLoading ? <LoadingList /> : (
        <>
          <SectionHeader title={t('perf.money')} action={t('common.seeAll')} onAction={() => router.push('/insights/finance')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <InfoTile icon="arrow-downward" label={t('finance.income')} value={rupees(total?.income ?? 0)} />
            <InfoTile icon="arrow-upward" label={t('finance.expense')} value={rupees(total?.expense ?? 0)} />
            <InfoTile icon="savings" label={t('finance.profit')} value={rupees(total?.profit ?? 0)} />
          </View>
          <SectionHeader title={t('dashboard.agriTitle')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <InfoTile icon="agriculture" label={t('perf.harvested')} value={`${Math.round(harvested * 10) / 10} q`} />
            <InfoTile icon="task-alt" label={t('perf.tasksDone')} value={String(r.data?.agriculture.tasksDone ?? 0)} />
            <InfoTile icon="assignment-late" label={t('command.overdue')} value={String(r.data?.agriculture.tasksOverdue ?? 0)} />
            <InfoTile icon="document-scanner" label={t('perf.scans')} value={String(r.data?.agriculture.scans ?? 0)} />
          </View>
          <SectionHeader title={t('aqua.aquaTitle')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <InfoTile icon="set-meal" label={t('ponds.feedUsed')} value={`${r.data?.aquaculture.feedKg ?? 0} kg`} />
            <InfoTile icon="inventory" label={t('perf.fishHarvest')} value={`${r.data?.aquaculture.harvestKg ?? 0} kg`} />
            <InfoTile icon="heart-broken" label={t('aquaX.totalDead')} value={String(r.data?.aquaculture.mortality ?? 0)} />
          </View>
          <SectionHeader title={t('livestock.livestockTitle')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <InfoTile icon="water-drop" label={t('perf.milk')} value={`${Math.round(milkL)} L`} />
            <InfoTile icon="vaccines" label={t('perf.vaccGiven')} value={String(r.data?.livestock.vaccinesGiven ?? 0)} />
            <InfoTile icon="sick" label={t('livestock.sick')} value={String(r.data?.livestock.sick ?? 0)} />
          </View>
          <AppText variant="bodySm" color={colors.textSubtle}>{t('perf.note')}</AppText>
        </>
      )}
    </Screen>
  );
}
