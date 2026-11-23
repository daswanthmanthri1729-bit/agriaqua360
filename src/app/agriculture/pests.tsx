// Pest intelligence — design: pest_intelligence. Weather-driven pest pressure + crop-specific pests to scout for.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, Header, Icon, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { weatherRisks } from '@/features/intel/crop';
import { useCropContext } from '@/features/intel/useCropContext';
import { colors } from '@/theme';

const PESTS: Record<string, string[]> = {
  paddy: ['stem_borer', 'bph', 'leaf_folder', 'gall_midge'], rice: ['stem_borer', 'bph', 'leaf_folder', 'gall_midge'],
  cotton: ['pink_bollworm', 'whitefly', 'jassids', 'thrips'], chilli: ['thrips', 'mites', 'fruit_borer'], chillies: ['thrips', 'mites', 'fruit_borer'],
  maize: ['fall_armyworm', 'stem_borer'], tomato: ['fruit_borer', 'whitefly', 'leaf_miner'], groundnut: ['leaf_miner', 'thrips', 'aphids'],
};

export default function Pests() {
  const { t } = useTranslation();
  const { loading, crop, weather, picker } = useCropContext();
  if (loading) return <Screen><Header title={t('pests.title')} /><LoadingList /></Screen>;
  const risks = weatherRisks(weather.data?.hourly ?? []).filter((r) => r.kind === 'sucking_pests' || r.kind === 'caterpillars');
  const list = crop ? PESTS[crop.name.trim().toLowerCase()] ?? [] : [];
  return (
    <Screen footer={<Button variant="ai" iconLeft="pest-control" label={t('pests.scan')} onPress={() => router.push('/agriculture/scan')} />}>
      <Header title={t('pests.title')} />
      {picker}
      <SectionHeader title={t('pests.pressure')} />
      {!weather.data?.hourly?.length ? <Banner tone="warning" message={t('irrigation.noLocation')} /> : (
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
      {crop && (
        <>
          <SectionHeader title={t('pests.scoutFor', { crop: crop.name })} />
          {list.length ? list.map((p) => (
            <Card key={p} style={{ flexDirection: 'row', gap: 10 }}>
              <Icon name="bug-report" color={colors.warning} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="labelLg">{t(`pests.names.${p}`)}</AppText>
                <AppText variant="bodySm" color={colors.textMuted}>{t(`pests.signs.${p}`)}</AppText>
              </View>
            </Card>
          )) : <Banner message={t('pests.generic')} />}
        </>
      )}
      <Banner message={t('pests.ipm')} />
      <Button variant="secondary" iconLeft="shield" label={t('protection.title')} onPress={() => router.push('/agriculture/protection')} />
    </Screen>
  );
}
