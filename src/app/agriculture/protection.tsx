// Crop protection centre — design: crop_protection_center. Treatments applied, upcoming sprays, safe spray window.
import { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, EmptyState, Header, Icon, LoadingList, Screen, SectionHeader } from '@/components';
import { useRecords, useTreatments } from '@/features/agriculture/api';
import { sprayWindow } from '@/features/intel/agronomy';
import { useCropContext } from '@/features/intel/useCropContext';
import { addDays, formatDate, formatStamp, today } from '@/lib/dates';
import { colors } from '@/theme';

export default function Protection() {
  const { t, i18n } = useTranslation();
  const { loading, crop, weather, picker } = useCropContext();
  const treatments = useTreatments(crop?.id ?? '');
  const recs = useRecords({ cropId: crop?.id, from: addDays(today(), -30), to: addDays(today(), 30) });
  const sprays = useMemo(() => (recs.data ?? []).filter((r) => r.activity === 'pesticide' || r.activity === 'fertilizer'), [recs.data]);
  const win = weather.data?.hourly ? sprayWindow(weather.data.hourly) : null;
  if (loading) return <Screen><Header title={t('protection.title')} /><LoadingList /></Screen>;
  if (!crop) return <Screen><Header title={t('protection.title')} /><EmptyState icon="eco" title={t('irrigation.noCrop')} action={t('dashboard.addCrop')} onAction={() => router.push('/agriculture/crops/new')} /></Screen>;
  return (
    <Screen>
      <Header title={t('protection.title')} />
      {picker}
      <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Icon name="sanitizer" color={win ? colors.primary : colors.warning} />
        <AppText variant="bodyMd" style={{ flex: 1 }}>{win ? t('weather.sprayWindow', { from: formatStamp(win.from, i18n.language, { weekday: 'short', hour: 'numeric' }), to: formatStamp(win.to, i18n.language, { hour: 'numeric' }) }) : t('weather.noSprayWindow')}</AppText>
      </Card>
      <SectionHeader title={t('protection.sprays')} action={t('calendar.addTask')} onAction={() => router.push('/agriculture/calendar')} />
      {sprays.length ? sprays.map((r) => (
        <Card key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name={r.activity === 'pesticide' ? 'pest-control' : 'science'} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="labelLg">{t(`calendar.activities.${r.activity}`)}</AppText>
            <AppText variant="bodySm" color={colors.textMuted}>{r.scheduled_for ? formatDate(r.scheduled_for, i18n.language) : ''}{r.notes ? ` · ${r.notes}` : ''}</AppText>
          </View>
          <Chip tone={r.completed_at ? 'normal' : 'warning'} label={t(r.completed_at ? 'protection.done' : 'protection.planned')} />
        </Card>
      )) : <AppText variant="bodyMd" color={colors.textMuted}>{t('protection.noSprays')}</AppText>}
      <SectionHeader title={t('protection.treatments')} />
      {treatments.data?.length ? treatments.data.map((x) => (
        <Card key={x.id} style={{ gap: 2 }}>
          <AppText variant="labelLg">{t(`treatment.groups.${x.treatment_type === 'biological' ? 'organic' : x.treatment_type}`)} · {formatDate(x.applied_on, i18n.language)}</AppText>
          <AppText variant="bodySm" color={colors.textMuted}>{x.description}</AppText>
          {x.follow_up_on && <AppText variant="labelSm" color={colors.warning}>{t('protection.followUp', { date: formatDate(x.follow_up_on, i18n.language) })}</AppText>}
        </Card>
      )) : <AppText variant="bodyMd" color={colors.textMuted}>{t('protection.noTreatments')}</AppText>}
      <Banner message={t('protection.safety')} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} variant="secondary" iconLeft="bug-report" label={t('pests.title')} onPress={() => router.push('/agriculture/pests')} />
        <Button style={{ flex: 1 }} variant="secondary" iconLeft="coronavirus" label={t('risk.title')} onPress={() => router.push('/agriculture/crop-risk')} />
      </View>
    </Screen>
  );
}
