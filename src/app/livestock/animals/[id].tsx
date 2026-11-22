// 28 · Animal Details
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, ErrorState, Header, InfoTile, LoadingList, Screen, SectionHeader, StorageImage } from '@/components';
import { useAnimal, useDeleteAnimal, useHealthRecords, useUpdateAnimal, useVaccinations } from '@/features/livestock/api';
import { animalLabel, SpeciesAvatar, STATUS_TONE, useAgeLabel } from '@/features/livestock/AnimalRow';
import { ANIMAL_STATUS } from '@/features/livestock/schemas';
import { VaccRow } from '@/features/livestock/VaccRow';
import { formatDate } from '@/lib/dates';
import type { AnimalStatus } from '@/types/database';
import { colors, radius } from '@/theme';

export default function AnimalDetails() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const animal = useAnimal(id);
  const health = useHealthRecords(id);
  const vaccs = useVaccinations(id);
  const update = useUpdateAnimal();
  const del = useDeleteAnimal();
  const ageLabel = useAgeLabel();

  if (animal.isLoading) return <Screen><Header /><LoadingList height={140} /></Screen>;
  if (animal.error || !animal.data) return <Screen><Header /><ErrorState onRetry={() => animal.refetch()} /></Screen>;
  const a = animal.data;
  const records = (tab: 'health' | 'vacc', add?: boolean) => router.push({ pathname: '/livestock/records', params: { animalId: a.id, tab, ...(add ? { add: '1' } : {}) } });

  const confirmDelete = () =>
    Alert.alert(t('livestock.deleteTitle'), t('livestock.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try { await del.mutateAsync(a.id); router.back(); } catch { Alert.alert(t('errors.generic')); }
      } },
    ]);

  return (
    <Screen footer={
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} variant="secondary" iconLeft="medical-services" label={t('livestock.addHealth')} onPress={() => records('health', true)} />
        <Button style={{ flex: 1 }} iconLeft="vaccines" label={t('livestock.addVacc')} onPress={() => records('vacc', true)} />
      </View>
    }>
      <Header title={t('livestock.details')} right={<Button compact variant="text" iconLeft="delete-outline" label={t('common.delete')} onPress={confirmDelete} loading={del.isPending} />} />
      <View style={styles.top}>
        {a.photo_path ? <StorageImage path={a.photo_path} style={{ width: 96, height: 96, borderRadius: radius.xl }} fallback="pets" /> : <SpeciesAvatar species={a.species} size={96} />}
        <View style={{ flex: 1, gap: 6 }}>
          <AppText variant="headlineLg">{animalLabel(a)}</AppText>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Chip label={t(`livestock.species.${a.species}`)} />
            <Chip tone={STATUS_TONE[a.status]} label={t(`livestock.statuses.${a.status}`)} />
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <InfoTile icon="category" label={t('livestock.breed')} value={a.breed ?? '—'} />
        <InfoTile icon="wc" label={t('livestock.sex')} value={a.sex ? t(`livestock.${a.sex}`) : '—'} />
        <InfoTile icon="cake" label={t('livestock.age')} value={ageLabel(a.birth_date) ?? '—'} />
        <InfoTile icon="monitor-weight" label={t('livestock.weight')} value={a.weight_kg != null ? `${a.weight_kg} kg` : '—'} />
      </View>
      {!!a.notes && <Card><AppText variant="bodyMd">{a.notes}</AppText></Card>}
      <ChoiceChips scroll label={t('livestock.status')} value={a.status}
        onChange={(status: AnimalStatus) => update.mutate({ id: a.id, patch: { status } }, { onError: () => Alert.alert(t('errors.generic')) })}
        options={ANIMAL_STATUS.map((s) => ({ value: s, label: t(`livestock.statuses.${s}`) }))} />
      {(a.status === 'sick' || a.status === 'under_treatment') && <Banner tone="warning" message={t('livestock.consultVet')} />}

      <SectionHeader title={t('livestock.vaccinations')} action={t('common.seeAll')} onAction={() => records('vacc')} />
      <Card style={{ paddingVertical: 4 }}>
        {vaccs.isLoading ? <LoadingList count={1} height={48} /> : vaccs.data?.length ? vaccs.data.slice(0, 4).map((v) => <VaccRow key={v.id} v={v} />)
          : <AppText variant="bodyMd" color={colors.textMuted} style={{ paddingVertical: 12 }}>{t('livestock.noVacc')}</AppText>}
      </Card>

      <SectionHeader title={t('livestock.health')} action={t('common.seeAll')} onAction={() => records('health')} />
      <Card style={{ gap: 10 }}>
        {health.isLoading ? <LoadingList count={1} height={48} /> : health.data?.length ? health.data.slice(0, 4).map((h) => (
          <View key={h.id} style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <Chip tone={h.record_type === 'illness' || h.record_type === 'injury' ? 'warning' : 'normal'} label={t(`livestock.healthTypes.${h.record_type === 'ai_assessment' ? 'checkup' : h.record_type}`)} />
              <AppText variant="labelSm" color={colors.textSubtle}>{formatDate(h.recorded_on, i18n.language)}</AppText>
            </View>
            {!!h.description && <AppText variant="bodyMd" numberOfLines={2}>{h.description}</AppText>}
          </View>
        )) : <AppText variant="bodyMd" color={colors.textMuted}>{t('livestock.noHealth')}</AppText>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({ top: { flexDirection: 'row', gap: 16, alignItems: 'center' } });
