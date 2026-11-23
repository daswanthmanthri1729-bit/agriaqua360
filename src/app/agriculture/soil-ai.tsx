// AI soil intelligence — design: ai_soil_intelligence. Rule-based Soil Health Card advice + AI explanation.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, EmptyState, Header, Icon, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { useFarms } from '@/features/agriculture/api';
import { useSoilEstimate, useSoilTests } from '@/features/intel/api';
import { soilAdvice } from '@/features/intel/crop';
import { InsightCard } from '@/features/intel/InsightCard';
import { farmPoint } from '@/features/intel/place';
import { useSession } from '@/store/session';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

export default function SoilAi() {
  const { t, i18n } = useTranslation();
  const farms = useFarms(); const profile = useSession((s) => s.profile);
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.data?.find((f) => f.id === (farmId ?? farms.data?.[0]?.id));
  const tests = useSoilTests(farm?.id ?? null);
  const pt = farmPoint(farm, profile);
  const est = useSoilEstimate(pt?.lat, pt?.lon);
  if (farms.isLoading) return <Screen><Header title={t('soilAi.title')} /><LoadingList /></Screen>;
  if (!farm) return <Screen><Header title={t('soilAi.title')} /><EmptyState icon="add-location-alt" title={t('soil.noFarm')} action={t('dashboard.addFarm')} onAction={() => router.push('/agriculture/farms/new')} /></Screen>;
  const latest = tests.data?.[0];
  const top = (p: string) => est.data?.layers.find((l) => l.property === p)?.depths[0]?.value ?? null;
  return (
    <Screen>
      <Header title={t('soilAi.title')} />
      {(farms.data?.length ?? 0) > 1 && <ChoiceChips scroll value={farm.id} onChange={setFarmId} options={farms.data!.map((f) => ({ value: f.id, label: f.name }))} />}
      <SectionHeader title={t('soilAi.advice')} />
      {latest ? (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <SourceBadge source="lab" label={t(`soil.src.${latest.source}`)} />
            <AppText variant="labelSm" color={colors.textSubtle}>{formatDate(latest.tested_on, i18n.language)}</AppText>
          </View>
          {soilAdvice(latest).map((k) => (
            <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
              <Icon name="check-circle" size={18} color={colors.primary} />
              <AppText variant="bodyMd" style={{ flex: 1 }}>{t(k)}</AppText>
            </View>
          ))}
          <AppText variant="labelSm" color={colors.textSubtle}>{t('soilAi.doseNote')}</AppText>
        </Card>
      ) : <Banner title={t('soil.noTestTitle')} message={t('soil.noTest')} />}
      {est.data?.texture && (
        <Card style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <SourceBadge source="model" label={t('soil.modelled')} />
            <Chip icon="grain" label={t(`soil.texture.${est.data.texture}`)} />
          </View>
          <AppText variant="bodyMd">{t(`soilAi.textureTip.${['clay', 'silty_clay', 'sandy_clay', 'clay_loam', 'silty_clay_loam'].includes(est.data.texture) ? 'heavy' : ['sand', 'loamy_sand', 'sandy_loam'].includes(est.data.texture) ? 'light' : 'medium'}`)}</AppText>
        </Card>
      )}
      <InsightCard kind="soil" id={farm.id} extra={est.data ? { texture: est.data.texture, ph: top('phh2o'), soc_g_kg: top('soc') } : null} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} variant="secondary" iconLeft="biotech" label={t('soilTests.title')} onPress={() => router.push('/agriculture/soil-tests')} />
        <Button style={{ flex: 1 }} variant="secondary" iconLeft="layers" label={t('dashboard.soil')} onPress={() => router.push('/agriculture/soil')} />
      </View>
    </Screen>
  );
}
