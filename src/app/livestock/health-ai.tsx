// Livestock health & disease intelligence — design: ai_livestock_health_disease_intelligence.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, EmptyState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { InsightCard } from '@/features/intel/InsightCard';
import { useAnimals, useHealthRecords, useVaccinations } from '@/features/livestock/api';
import { vaccState } from '@/features/livestock/vaccination';
import { formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';

export default function HealthAi() {
  const { t, i18n } = useTranslation();
  const animals = useAnimals(); const health = useHealthRecords(); const vaccs = useVaccinations();
  const herd = (animals.data ?? []).filter((a) => a.status !== 'sold' && a.status !== 'deceased');
  const [sel, setSel] = useState<string | null>(null);
  if (animals.isLoading) return <Screen><Header title={t('herd.healthTitle')} /><LoadingList /></Screen>;
  if (!herd.length) return <Screen><Header title={t('herd.healthTitle')} /><EmptyState icon="pets" title={t('livestock.emptyTitle')} action={t('livestock.addAnimal')} onAction={() => router.push('/livestock/animals/new')} /></Screen>;
  const sick = herd.filter((a) => a.status === 'sick' || a.status === 'under_treatment');
  const overdue = (vaccs.data ?? []).filter((v) => vaccState(v, today()) === 'overdue');
  const animal = herd.find((a) => a.id === sel) ?? sick[0] ?? herd[0];
  const recent = (health.data ?? []).filter((h) => h.recorded_on >= new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  return (
    <Screen>
      <Header title={t('herd.healthTitle')} />
      <Card style={{ flexDirection: 'row', gap: 8 }}>
        {[[t('livestock.sick'), sick.length], [t('herd.overdueVacc'), overdue.length], [t('herd.issues30'), recent.length]].map(([l, v]) => (
          <View key={l as string} style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="labelSm" color={colors.textSubtle} align="center">{l as string}</AppText>
            <AppText variant="headlineMd" color={(v as number) ? colors.warning : colors.primary}>{String(v)}</AppText>
          </View>
        ))}
      </Card>
      {sick.length > 0 && <Banner tone="warning" message={t('herd.sickList', { names: sick.map((a) => a.name ?? a.tag_id).join(', ') })} />}
      <SectionHeader title={t('herd.checkAnimal')} />
      <ChoiceChips scroll value={animal.id} onChange={setSel} options={herd.map((a) => ({ value: a.id, label: `${a.name ?? a.tag_id ?? t(`livestock.species.${a.species}`)}${a.status === 'sick' ? ' ⚠' : ''}` }))} />
      <InsightCard key={animal.id} kind="livestock" id={animal.id} />
      {recent.length > 0 && (
        <>
          <SectionHeader title={t('herd.recentIssues')} />
          {recent.slice(0, 8).map((h) => (
            <Card key={h.id} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <AppText variant="labelLg" style={{ flex: 1 }}>{herd.find((a) => a.id === h.animal_id)?.name ?? ''} · {t(`livestock.healthTypes.${h.record_type === 'ai_assessment' ? 'checkup' : h.record_type}`)}</AppText>
                <Chip tone="dark" label={formatDate(h.recorded_on, i18n.language, { day: 'numeric', month: 'short' })} />
              </View>
              {h.description && <AppText variant="bodySm" color={colors.textMuted} numberOfLines={2}>{h.description}</AppText>}
            </Card>
          ))}
        </>
      )}
      <Button variant="secondary" iconLeft="medical-services" label={t('livestock.healthRecords')} onPress={() => router.push('/livestock/records')} />
    </Screen>
  );
}
