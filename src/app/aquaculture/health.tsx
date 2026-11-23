// Fish health dashboard — design: fish_health_monitoring_dashboard. Water status, scans, deaths and alerts per pond.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Chip, EmptyState, Header, LoadingList, Screen } from '@/components';
import { useFishReports, usePonds } from '@/features/aquaculture/api';
import { overall } from '@/features/aquaculture/waterQuality';
import { useAlerts } from '@/features/iot/api';
import { colors } from '@/theme';

export default function FishHealth() {
  const { t } = useTranslation();
  const ponds = usePonds(); const reports = useFishReports(); const alerts = useAlerts('open');
  if (ponds.isLoading) return <Screen><Header title={t('aquaX.healthTitle')} /><LoadingList /></Screen>;
  if (!ponds.data?.length) return <Screen><Header title={t('aquaX.healthTitle')} /><EmptyState icon="water" title={t('aquaX.noPond')} action={t('aquaX.addPond')} onAction={() => router.push('/aquaculture/ponds')} /></Screen>;
  return (
    <Screen footer={<Button variant="ai" iconLeft="set-meal" label={t('aqua.scanFish')} onPress={() => router.push('/aquaculture/fish-scan')} />}>
      <Header title={t('aquaX.healthTitle')} />
      {ponds.data.map((p) => {
        const lv = p.latest ? overall(p.latest) : null;
        const last = (reports.data ?? []).find((r) => r.pond_id === p.id);
        const pa = (alerts.data ?? []).filter((a) => a.pond_id === p.id && a.status === 'open');
        return (
          <Card key={p.id} onPress={() => router.push(`/aquaculture/ponds/${p.id}`)} accessibilityLabel={p.name} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <AppText variant="labelLg" style={{ flex: 1 }}>{p.name}{p.species ? ` · ${p.species}` : ''}</AppText>
              {lv && <Chip tone={lv === 'ok' ? 'normal' : lv === 'warn' ? 'warning' : 'error'} label={t(`water.status.${lv}`)} />}
            </View>
            <AppText variant="bodySm" color={colors.textMuted}>
              {last ? `${t('aquaX.lastScan')}: ${last.condition_name ?? '—'}${last.severity ? ` (${t(`result.severity.${last.severity}`)})` : ''}` : t('aquaX.noScan')}
            </AppText>
            {pa.length > 0 && <Chip tone="error" icon="warning-amber" label={t('fleet.alertsN', { count: pa.length })} />}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Button compact variant="text" label={t('aquaX.mortalityTitle')} onPress={() => router.push({ pathname: '/aquaculture/mortality', params: { pond: p.id } })} />
              <Button compact variant="text" label={t('aquaX.analyticsTitle')} onPress={() => router.push({ pathname: '/aquaculture/water-analytics', params: { pond: p.id } })} />
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
