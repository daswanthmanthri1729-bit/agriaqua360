// 38 · Farming Reports — totals computed in the database (report_summary), RLS-scoped
import { useState } from 'react';
import { Share, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, ChoiceChips, ErrorState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { useReport } from '@/features/reports/api';
import type { Report } from '@/features/reports/api';
import { formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';

type Row = [label: string, value: string | number, alert?: boolean];

export default function Reports() {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState('30');
  const report = useReport(Number(days));
  const r = report.data;
  const kg = (n: number) => `${n.toLocaleString()} ${t('ponds.units.kg')}`;

  const sections = (x: Report): [string, Row[]][] => [
    [t('dashboard.agriTitle'), [
      [t('reports.farms'), x.agriculture.farms], [t('reports.area'), `${x.agriculture.acres} ${t('common.acres')}`],
      [t('reports.growing'), x.agriculture.cropsByStatus.growing ?? 0], [t('reports.harvested'), x.agriculture.cropsByStatus.harvested ?? 0],
      [t('reports.tasksDone'), x.agriculture.tasksDone], [t('reports.tasksOverdue'), x.agriculture.tasksOverdue, x.agriculture.tasksOverdue > 0],
      [t('reports.scans'), x.agriculture.scans],
    ]],
    [t('aqua.title'), [
      [t('reports.ponds'), x.aquaculture.ponds], [t('reports.activePonds'), x.aquaculture.activePonds], [t('reports.readings'), x.aquaculture.readings],
      [t('reports.pondsBad'), x.aquaculture.pondsByLevel.bad ?? 0, (x.aquaculture.pondsByLevel.bad ?? 0) > 0],
      [t('reports.feed'), kg(x.aquaculture.feedKg)], [t('reports.harvest'), kg(x.aquaculture.harvestKg)], [t('reports.mortality'), x.aquaculture.mortality, x.aquaculture.mortality > 0],
    ]],
    [t('livestock.title'), [
      [t('reports.animals'), x.livestock.animals], [t('reports.sick'), x.livestock.sick, x.livestock.sick > 0],
      [t('reports.vaccinesGiven'), x.livestock.vaccinesGiven], [t('reports.vaccinesOverdue'), x.livestock.vaccinesOverdue, x.livestock.vaccinesOverdue > 0],
    ]],
  ];

  const share = () => {
    if (!r) return;
    const text = [`${t('reports.shareTitle')} — ${t('reports.days', { count: r.days })}`, t('reports.generated', { date: formatDate(today(), i18n.language) }),
      ...sections(r).flatMap(([title, rows]) => ['', `*${title}*`, ...rows.map(([l, v]) => `${l}: ${v}`)])].join('\n');
    Share.share({ message: text }).catch(() => {});
  };

  return (
    <Screen footer={r ? <Button testID="report-share" iconLeft="share" label={t('reports.share')} onPress={share} /> : undefined}>
      <Header title={t('reports.title')} />
      <ChoiceChips label={t('reports.period')} value={days} onChange={setDays} options={['7', '30', '90'].map((d) => ({ value: d, label: t('reports.days', { count: Number(d) }) }))} />
      <AppText variant="bodySm" color={colors.textSubtle}>{t('reports.basis')}</AppText>
      {report.isLoading ? <LoadingList count={3} height={180} /> : report.error || !r ? <ErrorState onRetry={() => report.refetch()} /> : sections(r).map(([title, rows]) => (
        <View key={title} style={{ gap: 8 }}>
          <SectionHeader title={title} />
          <Card style={{ gap: 10 }}>
            {rows.map(([label, value, alert]) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <AppText variant="bodyMd" color={colors.textMuted} style={{ flex: 1 }}>{label}</AppText>
                <AppText variant="labelLg" color={alert ? colors.error : colors.text}>{value}</AppText>
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
