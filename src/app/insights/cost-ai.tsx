// AI cost optimisation — design: ai_farm_cost_optimization_financial_insights.
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Header, LoadingList, Screen } from '@/components';
import { useFinanceSummary } from '@/features/intel/api';
import { InsightCard } from '@/features/intel/InsightCard';
import { addDays, today } from '@/lib/dates';
import { colors } from '@/theme';

const rupees = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;

export default function CostAi() {
  const { t } = useTranslation();
  const sum = useFinanceSummary(addDays(today(), -365), today());
  const total = sum.data?.find((r) => r.scope === 'total');
  return (
    <Screen>
      <Header title={t('costAi.title')} />
      {sum.isLoading ? <LoadingList count={1} /> : (
        <Card style={{ gap: 4 }}>
          <AppText variant="labelSm" color={colors.textSubtle}>{t('costAi.year')}</AppText>
          <AppText variant="bodyLg">{t('finance.inOut', { income: rupees(total?.income ?? 0), expense: rupees(total?.expense ?? 0) })}</AppText>
          <AppText variant="headlineSm" color={(total?.profit ?? 0) >= 0 ? colors.secondary : colors.error}>{t('finance.profit')}: {rupees(total?.profit ?? 0)}</AppText>
        </Card>
      )}
      <InsightCard kind="finance" id={null} />
      <Button variant="secondary" iconLeft="receipt-long" label={t('costs.title')} onPress={() => router.push('/insights/costs')} />
      <Button variant="secondary" iconLeft="calculate" label={t('profit.title')} onPress={() => router.push('/insights/profitability')} />
    </Screen>
  );
}
