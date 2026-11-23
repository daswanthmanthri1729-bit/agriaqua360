// Crop health risk analysis — design: crop_health_risk_analysis. Weather-driven disease risk + recent photo diagnoses.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, EmptyState, Header, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { useScans } from '@/features/agriculture/api';
import { weatherRisks } from '@/features/intel/crop';
import { useCropContext } from '@/features/intel/useCropContext';
import { formatDate, isoDate } from '@/lib/dates';
import { colors } from '@/theme';

const DISEASE = ['fungal', 'bacterial', 'heat_stress'];

export default function CropRisk() {
  const { t, i18n } = useTranslation();
  const { loading, crop, weather, picker } = useCropContext();
  const scans = useScans(crop?.id);
  if (loading) return <Screen><Header title={t('risk.title')} /><LoadingList /></Screen>;
  if (!crop) return <Screen><Header title={t('risk.title')} /><EmptyState icon="eco" title={t('irrigation.noCrop')} action={t('dashboard.addCrop')} onAction={() => router.push('/agriculture/crops/new')} /></Screen>;
  const risks = weatherRisks(weather.data?.hourly ?? []).filter((r) => DISEASE.includes(r.kind));
  const severe = (scans.data ?? []).filter((s) => s.report?.[0]?.severity === 'severe' || s.report?.[0]?.severity === 'moderate');
  return (
    <Screen footer={<Button variant="ai" iconLeft="document-scanner" label={t('dashboard.scanCrop')} onPress={() => router.push('/agriculture/scan')} />}>
      <Header title={t('risk.title')} />
      {picker}
      <SectionHeader title={t('risk.next48', { crop: crop.name })} />
      {weather.isLoading ? <LoadingList count={1} /> : !weather.data?.hourly?.length ? <Banner tone="warning" message={t('irrigation.noLocation')} /> : (
        <Card style={{ gap: 10 }}>
          {risks.map((r) => (
            <View key={r.kind} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AppText variant="labelLg" style={{ flex: 1 }}>{t(`risk.${r.kind}`)}</AppText>
                <Chip tone={r.level === 'high' ? 'error' : r.level === 'medium' ? 'warning' : 'normal'} label={t(`risk.level.${r.level}`)} />
              </View>
              <AppText variant="bodySm" color={colors.textMuted}>{t(`risk.why.${r.kind}`, { hours: r.hours })}</AppText>
            </View>
          ))}
          <SourceBadge source="ai_estimate" label={t('risk.weatherBased')} />
        </Card>
      )}
      <SectionHeader title={t('risk.recentScans')} />
      {severe.length > 0 && <Banner tone="warning" message={t('risk.activeIssues', { count: severe.length })} />}
      {(scans.data ?? []).slice(0, 6).map((s) => (
        <Card key={s.id} onPress={() => router.push(`/agriculture/scan/${s.id}`)} accessibilityLabel={s.report?.[0]?.condition_name ?? ''} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="labelLg" numberOfLines={1}>{s.report?.[0]?.condition_name ?? t('risk.pending')}</AppText>
            <AppText variant="bodySm" color={colors.textMuted}>{formatDate(isoDate(new Date(s.created_at)), i18n.language)}</AppText>
          </View>
          {s.report?.[0]?.severity && <Chip tone={s.report[0].severity === 'severe' ? 'error' : s.report[0].severity === 'none' ? 'normal' : 'warning'} label={t(`result.severity.${s.report[0].severity}`)} />}
        </Card>
      ))}
      {!scans.data?.length && <AppText variant="bodyMd" color={colors.textMuted}>{t('risk.noScans')}</AppText>}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('risk.note')}</AppText>
    </Screen>
  );
}
