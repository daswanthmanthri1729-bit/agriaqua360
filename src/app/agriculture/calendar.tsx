// 16 · Crop Calendar — Stitch: 24_crop_schedule / 47_smart_reminders_farming_calendar
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, EmptyState, ErrorState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { useCrops, useRecords } from '@/features/agriculture/api';
import { AddTaskSheet } from '@/features/agriculture/AddTaskSheet';
import { TaskRow } from '@/features/agriculture/TaskRow';
import { addDays, formatDate, today } from '@/lib/dates';
import { colors, fonts, radius } from '@/theme';

const DAYS = 30;

export default function CropCalendar() {
  const { t, i18n } = useTranslation();
  const now = today();
  const [selected, setSelected] = useState(now);
  const [open, setOpen] = useState(false);
  const crops = useCrops();
  const records = useRecords({ from: addDays(now, -60), to: addDays(now, DAYS) });

  const strip = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(now, i - 2)), [now]);
  const all = records.data ?? [];
  const overdue = all.filter((r) => !r.completed_at && r.scheduled_for! < now);
  const dayTasks = all.filter((r) => r.scheduled_for === selected);
  const busy = new Set(all.filter((r) => !r.completed_at).map((r) => r.scheduled_for));
  const cropList = (crops.data ?? []).filter((c) => c.status !== 'harvested' && c.status !== 'failed').map((c) => ({ id: c.id, name: c.name }));

  return (
    <Screen footer={cropList.length ? <Button testID="calendar-add" label={t('calendar.add')} iconLeft="add" onPress={() => setOpen(true)} /> : undefined}>
      <Header title={t('calendar.title')} />
      <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {strip.map((d) => {
          const on = d === selected;
          return (
            <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: on }}
              accessibilityLabel={formatDate(d, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })}
              onPress={() => setSelected(d)} style={[styles.day, on && styles.dayOn, d === now && !on && { borderColor: colors.primary }]}>
              <AppText variant="labelSm" color={on ? colors.mint : colors.textSubtle}>{formatDate(d, i18n.language, { weekday: 'short' })}</AppText>
              <AppText style={[styles.dayNum, { color: on ? colors.white : colors.text }]}>{formatDate(d, i18n.language, { day: 'numeric' })}</AppText>
              <View style={[styles.dot, { backgroundColor: busy.has(d) ? (on ? colors.lime : colors.secondary) : 'transparent' }]} />
            </Pressable>
          );
        })}
      </ScrollView>

      {records.isLoading ? <LoadingList count={3} height={56} /> : records.error ? <ErrorState onRetry={() => records.refetch()} /> : !cropList.length && !all.length ? (
        <EmptyState icon="event-note" title={t('calendar.noCrops')} />
      ) : (
        <>
          {overdue.length > 0 && (
            <>
              <SectionHeader title={`${t('calendar.overdue')} (${overdue.length})`} />
              <Card style={{ paddingVertical: 4, borderColor: colors.errorSurface }}>{overdue.map((r) => <TaskRow key={r.id} r={r} showCrop showDate />)}</Card>
            </>
          )}
          <SectionHeader title={selected === now ? t('calendar.today') : formatDate(selected, i18n.language, { weekday: 'long', day: 'numeric', month: 'long' })} />
          <Card style={{ paddingVertical: 4 }}>
            {dayTasks.length ? dayTasks.map((r) => <TaskRow key={r.id} r={r} showCrop />) : (
              <AppText variant="bodyMd" color={colors.textMuted} style={{ paddingVertical: 12 }}>{t('calendar.noTasks')}</AppText>
            )}
          </Card>
        </>
      )}
      <AddTaskSheet visible={open} onClose={() => setOpen(false)} crops={cropList} date={selected >= now ? selected : now} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  day: { width: 60, paddingVertical: 10, borderRadius: radius.lg, alignItems: 'center', gap: 2, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  dayOn: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  dayNum: { fontFamily: fonts.headingBold, fontSize: 20, lineHeight: 28 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
