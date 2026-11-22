// 14 · Crop Details — Stitch: 17_crop_details_screen
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Chip, ChoiceChips, ErrorState, Header, InfoTile, LoadingList, Screen, SectionHeader, StorageImage } from '@/components';
import { useCrop, useDeleteCrop, useRecords, useScans, useTreatments, useUpdateCrop } from '@/features/agriculture/api';
import { AddTaskSheet } from '@/features/agriculture/AddTaskSheet';
import { TaskRow } from '@/features/agriculture/TaskRow';
import { CROP_STATUS } from '@/features/agriculture/schemas';
import { daysBetween, formatDate, today } from '@/lib/dates';
import { colors, radius } from '@/theme';
import type { CropStatus } from '@/types/database';

export default function CropDetails() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const crop = useCrop(id);
  const records = useRecords({ cropId: id });
  const scans = useScans(id);
  const treatments = useTreatments(id);
  const update = useUpdateCrop();
  const del = useDeleteCrop();
  const [taskOpen, setTaskOpen] = useState(false);

  if (crop.isLoading) return <Screen><Header /><LoadingList height={140} /></Screen>;
  if (crop.error || !crop.data) return <Screen><Header /><ErrorState onRetry={() => crop.refetch()} /></Screen>;
  const c = crop.data;
  const day = c.sowing_date ? daysBetween(c.sowing_date, today()) : null;
  const left = c.expected_harvest_date ? daysBetween(today(), c.expected_harvest_date) : null;
  const fmt = (d: string | null) => (d ? formatDate(d, i18n.language) : '—');

  const confirmDelete = () =>
    Alert.alert(t('crops.deleteTitle'), t('crops.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => { await del.mutateAsync(c.id); router.back(); } },
    ]);

  return (
    <Screen footer={<Button testID="scan-this-crop" variant="ai" iconLeft="document-scanner" label={t('crops.scanCrop')} onPress={() => router.push({ pathname: '/agriculture/scan', params: { cropId: c.id } })} />}>
      <Header title={t('crops.details')} right={<Button compact variant="text" iconLeft="delete-outline" label={t('common.delete')} onPress={confirmDelete} loading={del.isPending} />} />
      <View style={styles.hero}><StorageImage path={c.photo_path} style={StyleSheet.absoluteFill} fallback="eco" label={c.name} /></View>
      <View style={{ gap: 6 }}>
        <AppText variant="display">{c.name}</AppText>
        {!!c.variety && <AppText variant="bodyLg" color={colors.textMuted}>{c.variety}</AppText>}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {c.season && <Chip icon="wb-sunny" label={t(`crops.seasons.${c.season}`)} />}
          {day != null && day >= 0 && c.status === 'growing' && <Chip tone="ai" icon="timelapse" label={t('crops.daysSinceSowing', { count: day })} />}
          {left != null && c.status === 'growing' && <Chip tone={left <= 7 ? 'warning' : 'normal'} icon="agriculture" label={left > 0 ? t('crops.harvestIn', { count: left }) : t('crops.harvestDue')} />}
        </View>
      </View>
      <View style={styles.grid}>
        <InfoTile icon="landscape" label={t('crops.farm')} value={c.farm?.name ?? '—'} />
        <InfoTile icon="square-foot" label={t('crops.area')} value={c.area_acres != null ? `${c.area_acres} ${t('common.acres')}` : '—'} />
        <InfoTile icon="grass" label={t('crops.sown')} value={fmt(c.sowing_date)} />
        <InfoTile icon="event-available" label={t('crops.harvest')} value={fmt(c.expected_harvest_date)} />
      </View>
      <ChoiceChips scroll label={t('crops.status')} value={c.status} onChange={(status: CropStatus) => update.mutate({ id: c.id, patch: { status } })}
        options={CROP_STATUS.map((s) => ({ value: s, label: t(`crops.statuses.${s}`) }))} />

      <SectionHeader title={t('crops.activities')} action={t('crops.addActivity')} onAction={() => setTaskOpen(true)} />
      <Card style={{ paddingVertical: 4 }}>
        {records.isLoading ? <LoadingList count={2} height={48} /> : records.data?.length ? (
          records.data.map((r) => <TaskRow key={r.id} r={r} showDate />)
        ) : <AppText variant="bodyMd" color={colors.textMuted} style={{ paddingVertical: 12 }}>{t('crops.noActivities')}</AppText>}
      </Card>

      {!!treatments.data?.length && (
        <>
          <SectionHeader title={t('crops.treatments')} />
          <Card style={{ gap: 8 }}>
            {treatments.data.map((tr) => (
              <View key={tr.id} style={{ gap: 2 }}>
                <Chip label={t(`treatment.groups.${tr.treatment_type === 'biological' ? 'organic' : tr.treatment_type}`)} tone={tr.treatment_type === 'chemical' ? 'warning' : 'normal'} />
                <AppText variant="bodyMd">{tr.description}</AppText>
              </View>
            ))}
          </Card>
        </>
      )}

      <SectionHeader title={t('crops.scans')} />
      {scans.data?.length ? scans.data.map((s) => (
        <Card key={s.id} onPress={() => router.push(`/agriculture/scan/${s.id}`)} style={styles.scanRow} accessibilityLabel={s.report[0]?.condition_name ?? t('scan.pending')}>
          <StorageImage path={s.image_paths[0]} style={styles.scanThumb} />
          <View style={{ flex: 1 }}>
            <AppText variant="labelLg" numberOfLines={1}>{s.report[0]?.condition_name ?? t(s.status === 'failed' ? 'scan.failed' : 'scan.pending')}</AppText>
            <AppText variant="bodySm" color={colors.textMuted}>{formatDate(s.created_at.slice(0, 10), i18n.language)}</AppText>
          </View>
          {s.report[0]?.severity && <Chip tone={s.report[0].severity === 'severe' ? 'error' : s.report[0].severity === 'none' ? 'normal' : 'warning'} label={t(`result.severity.${s.report[0].severity}`)} />}
        </Card>
      )) : <AppText variant="bodyMd" color={colors.textMuted}>{t('crops.noScans')}</AppText>}

      <AddTaskSheet visible={taskOpen} onClose={() => setTaskOpen(false)} crops={[{ id: c.id, name: c.name }]} cropId={c.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 190, borderRadius: radius.xl, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  scanThumb: { width: 56, height: 56, borderRadius: radius.md },
});
