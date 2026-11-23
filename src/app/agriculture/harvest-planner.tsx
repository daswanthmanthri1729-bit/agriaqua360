// Harvest scheduler with weather risk — design: smart_harvest_scheduler_weather_risk_planner.
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, EmptyState, Header, Icon, LoadingList, Screen, SectionHeader } from '@/components';
import { useCreateRecord } from '@/features/agriculture/api';
import { cropTimeline, harvestWindows } from '@/features/intel/crop';
import { useCropContext } from '@/features/intel/useCropContext';
import { conditionIcon } from '@/features/weather/api';
import { formatDate, today } from '@/lib/dates';
import { colors, radius } from '@/theme';

export default function HarvestPlanner() {
  const { t, i18n } = useTranslation();
  const { crop: cropParam } = useLocalSearchParams<{ crop?: string }>();
  const { loading, crop, weather, picker } = useCropContext(cropParam);
  const create = useCreateRecord();
  const [picked, setPicked] = useState<string | null>(null);
  if (loading) return <Screen><Header title={t('harvest.plannerTitle')} /><LoadingList /></Screen>;
  if (!crop) return <Screen><Header title={t('harvest.plannerTitle')} /><EmptyState icon="agriculture" title={t('irrigation.noCrop')} /></Screen>;
  const days = weather.data?.daily ?? [];
  const dry = harvestWindows(days);
  const tl = cropTimeline(crop, today());
  const schedule = async () => {
    if (!picked) return;
    try {
      await create.mutateAsync({ input: { crop_id: crop.id, activity: 'harvest', scheduled_for: picked, notes: t('harvest.scheduledNote'), remind: true }, cropName: crop.name, title: t('harvest.reminderTitle'), body: t('calendar.activities.harvest') });
      Alert.alert(t('harvest.scheduled', { date: formatDate(picked, i18n.language) }));
      router.push('/agriculture/calendar');
    } catch { Alert.alert(t('errors.generic')); }
  };
  return (
    <Screen footer={<Button iconLeft="event-available" label={picked ? t('harvest.scheduleOn', { date: formatDate(picked, i18n.language, { weekday: 'short', day: 'numeric' }) }) : t('harvest.pickDay')} disabled={!picked} loading={create.isPending} onPress={schedule} />}>
      <Header title={t('harvest.plannerTitle')} />
      {picker}
      <AppText variant="headlineSm">{crop.name}</AppText>
      {tl && <AppText variant="bodyMd" color={colors.textMuted}>{t('harvest.daysLeft', { count: tl.daysLeft })} · {formatDate(tl.harvest, i18n.language)}</AppText>}
      {weather.isLoading ? <LoadingList count={1} /> : !days.length ? <Banner tone="warning" message={t('irrigation.noLocation')} /> : (
        <>
          <SectionHeader title={t('harvest.next7')} />
          <View style={{ gap: 8 }}>
            {days.map((d) => {
              const good = dry.includes(d.date), sel = picked === d.date;
              return (
                <Pressable key={d.date} accessibilityRole="radio" accessibilityState={{ selected: sel }} onPress={() => setPicked(d.date)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: sel ? 2 : 1, borderColor: sel ? colors.primary : colors.border, backgroundColor: good ? colors.surface : colors.warningSurface }}>
                  <Icon name={conditionIcon(d.condition) as 'cloud'} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="labelLg">{formatDate(d.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'short' })}</AppText>
                    <AppText variant="bodySm" color={colors.textMuted}>{d.pop}% · {d.rain_mm} mm · {d.wind_kmh} km/h · {d.max}°C</AppText>
                  </View>
                  <AppText variant="labelMd" color={good ? colors.secondary : colors.warning}>{t(good ? 'harvest.goodDay' : 'harvest.riskyDay')}</AppText>
                </Pressable>
              );
            })}
          </View>
          {!dry.length && <Banner tone="warning" message={t('harvest.noDryDay')} />}
          <AppText variant="bodySm" color={colors.textSubtle}>{t('harvest.windowRule')}</AppText>
        </>
      )}
    </Screen>
  );
}
