// Soil test records & comparison — design: soil_testing_lab_analysis.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, ChoiceChips, EmptyState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { useFarms } from '@/features/agriculture/api';
import { rateNutrient, ratePh } from '@/features/intel/agronomy';
import { useSoilTests } from '@/features/intel/api';
import { SoilTestSheet } from '@/features/intel/SoilTestSheet';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';
import type { SoilTest } from '@/types/database';

const ROWS: { key: keyof SoilTest; label: string; unit: string; rate?: 'n' | 'p' | 'k' | 'oc' | 'ph' }[] = [
  { key: 'ph', label: 'pH', unit: '', rate: 'ph' }, { key: 'ec_dsm', label: 'EC', unit: 'dS/m' }, { key: 'organic_carbon_pct', label: 'soil.oc', unit: '%', rate: 'oc' },
  { key: 'nitrogen_kg_ha', label: 'soil.n', unit: 'kg/ha', rate: 'n' }, { key: 'phosphorus_kg_ha', label: 'soil.p', unit: 'kg/ha', rate: 'p' }, { key: 'potassium_kg_ha', label: 'soil.k', unit: 'kg/ha', rate: 'k' },
  { key: 'sulphur_ppm', label: 'soil.s', unit: 'ppm' }, { key: 'zinc_ppm', label: 'soil.zn', unit: 'ppm' },
];

export default function SoilTests() {
  const { t, i18n } = useTranslation();
  const farms = useFarms();
  const [farmId, setFarmId] = useState<string | null>(null);
  const farm = farms.data?.find((f) => f.id === (farmId ?? farms.data?.[0]?.id));
  const q = useSoilTests(farm?.id ?? null);
  const [open, setOpen] = useState(false);
  if (farms.isLoading) return <Screen><Header title={t('soilTests.title')} /><LoadingList /></Screen>;
  if (!farm) return <Screen><Header title={t('soilTests.title')} /><EmptyState icon="add-location-alt" title={t('soil.noFarm')} action={t('dashboard.addFarm')} onAction={() => router.push('/agriculture/farms/new')} /></Screen>;
  const [a, b] = q.data ?? [];
  const rate = (r: string | undefined, v: number | null) => (v == null || !r ? null : r === 'ph' ? ratePh(v) : rateNutrient(r as 'n', v));
  return (
    <Screen footer={<Button iconLeft="biotech" label={t('soil.addTest')} onPress={() => setOpen(true)} />}>
      <Header title={t('soilTests.title')} />
      {(farms.data?.length ?? 0) > 1 && <ChoiceChips scroll value={farm.id} onChange={setFarmId} options={farms.data!.map((f) => ({ value: f.id, label: f.name }))} />}
      {q.isLoading ? <LoadingList /> : !a ? <EmptyState icon="biotech" title={t('soil.noTestTitle')} text={t('soil.noTest')} action={t('soil.addTest')} onAction={() => setOpen(true)} /> : (
        <>
          <SectionHeader title={b ? t('soilTests.compare') : t('soilTests.latest')} />
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AppText variant="labelSm" color={colors.textSubtle} style={{ flex: 1.2 }}> </AppText>
              <AppText variant="labelSm" color={colors.textSubtle} style={{ flex: 1 }}>{formatDate(a.tested_on, i18n.language)}</AppText>
              {b && <AppText variant="labelSm" color={colors.textSubtle} style={{ flex: 1 }}>{formatDate(b.tested_on, i18n.language)}</AppText>}
            </View>
            {ROWS.filter((r) => a[r.key] != null || b?.[r.key] != null).map((r) => {
              const va = a[r.key] as number | null, vb = b ? (b[r.key] as number | null) : null;
              const rt = rate(r.rate, va);
              return (
                <View key={r.key} style={{ flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 32 }}>
                  <AppText variant="bodyMd" style={{ flex: 1.2 }}>{t(r.label)}</AppText>
                  <AppText variant="labelLg" style={{ flex: 1 }}>{va ?? '—'} {r.unit}{rt ? ` · ${t(`soil.rating.${rt}`)}` : ''}</AppText>
                  {b && <AppText variant="bodyMd" color={colors.textMuted} style={{ flex: 1 }}>{vb ?? '—'}{va != null && vb != null && va !== vb ? (va > vb ? ' ↑' : ' ↓') : ''}</AppText>}
                </View>
              );
            })}
          </Card>
          <SectionHeader title={t('soilTests.all')} />
          {q.data!.map((x) => (
            <Card key={x.id} style={{ gap: 2 }}>
              <AppText variant="labelLg">{formatDate(x.tested_on, i18n.language)} · {t(`soil.src.${x.source}`)}</AppText>
              <AppText variant="bodySm" color={colors.textMuted}>{[x.lab_name, x.ph != null && `pH ${x.ph}`, x.nitrogen_kg_ha != null && `N ${x.nitrogen_kg_ha}`, x.phosphorus_kg_ha != null && `P ${x.phosphorus_kg_ha}`, x.potassium_kg_ha != null && `K ${x.potassium_kg_ha}`].filter(Boolean).join(' · ')}</AppText>
            </Card>
          ))}
          <Button variant="ai" iconLeft="auto-awesome" label={t('soilAi.title')} onPress={() => router.push('/agriculture/soil-ai')} />
        </>
      )}
      <SoilTestSheet visible={open} onClose={() => setOpen(false)} farmId={farm.id} />
    </Screen>
  );
}
