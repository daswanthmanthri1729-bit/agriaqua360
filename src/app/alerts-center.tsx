// Alerts, notifications & tasks — design: unified_alert_notification_task_center.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, ChoiceChips, EmptyState, Header, Icon, IconName, LoadingList, Screen } from '@/components';
import { ACTIVITY_ICON, useRecords, useToggleRecord } from '@/features/agriculture/api';
import { useAlerts, useDevices, useRealtime, useUpdateAlert } from '@/features/iot/api';
import { AlertRow } from '@/features/iot/AlertRow';
import { useVaccinations } from '@/features/livestock/api';
import { vaccState } from '@/features/livestock/vaccination';
import { CATEGORY_ICON, useMarkRead, useNotifications } from '@/features/notifications/api';
import { ago } from '@/components/Freshness';
import { addDays, formatDate, today } from '@/lib/dates';
import { colors } from '@/theme';

export default function AlertsCenter() {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<'alerts' | 'notes' | 'tasks'>('alerts');
  const alerts = useAlerts('open'); const devices = useDevices(); const ack = useUpdateAlert();
  const notes = useNotifications(); const read = useMarkRead();
  const tasks = useRecords({ to: addDays(today(), 3) }); const toggle = useToggleRecord();
  const vaccs = useVaccinations();
  useRealtime('sensor_alerts', null, [['alerts']]);
  useRealtime('notifications', null, [['notifications']]);
  const openTasks = (tasks.data ?? []).filter((r) => !r.completed_at);
  const dueVacc = (vaccs.data ?? []).filter((v) => ['overdue', 'due_soon'].includes(vaccState(v, today())));
  const counts = { alerts: alerts.data?.filter((a) => a.status === 'open').length ?? 0, notes: (notes.data ?? []).filter((n) => !n.read_at).length, tasks: openTasks.length + dueVacc.length };
  return (
    <Screen>
      <Header title={t('alertsCenter.title')} />
      <ChoiceChips value={tab} onChange={setTab} options={(['alerts', 'notes', 'tasks'] as const).map((k) => ({ value: k, label: `${t(`alertsCenter.${k}`)} (${counts[k]})` }))} />
      {tab === 'alerts' && (alerts.isLoading ? <LoadingList /> : !alerts.data?.length ? <EmptyState icon="verified" title={t('alerts.none')} text={t('alerts.noneText')} /> : (
        <Card style={{ gap: 4, paddingVertical: 6 }}>
          {alerts.data.map((a) => <AlertRow key={a.id} alert={a} device={devices.data?.devices.find((d) => d.id === a.device_id)} onAck={() => ack.mutate({ id: a.id, status: 'acknowledged' })} />)}
        </Card>
      ))}
      {tab === 'notes' && (notes.isLoading ? <LoadingList /> : !notes.data?.length ? <EmptyState icon="notifications-none" title={t('notifications.empty')} /> : (
        <Card style={{ gap: 4, paddingVertical: 6 }}>
          {notes.data.slice(0, 40).map((n) => (
            <Pressable key={n.id} accessibilityRole="button" onPress={() => { if (!n.read_at) read.mutate([n.id]); if (n.route) router.push(n.route as never); }} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 56 }}>
              <Icon name={(CATEGORY_ICON[n.category] ?? 'notifications') as IconName} color={n.read_at ? colors.textSubtle : colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText variant={n.read_at ? 'bodyMd' : 'labelLg'} numberOfLines={2}>{n.title}</AppText>
                <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>{n.body ? `${n.body} · ` : ''}{ago(n.created_at, t)}</AppText>
              </View>
            </Pressable>
          ))}
        </Card>
      ))}
      {tab === 'tasks' && (tasks.isLoading ? <LoadingList /> : !counts.tasks ? <EmptyState icon="task-alt" title={t('alertsCenter.noTasks')} /> : (
        <Card style={{ gap: 4, paddingVertical: 6 }}>
          {openTasks.map((r) => (
            <View key={r.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 56 }}>
              <Icon name={ACTIVITY_ICON[r.activity] as IconName} color={r.scheduled_for! < today() ? colors.error : colors.primary} />
              <Pressable style={{ flex: 1 }} accessibilityRole="button" onPress={() => r.crop && router.push(`/agriculture/crops/${r.crop.id}`)}>
                <AppText variant="labelLg">{t(`calendar.activities.${r.activity}`)} · {r.crop?.name}</AppText>
                <AppText variant="bodySm" color={r.scheduled_for! < today() ? colors.error : colors.textMuted}>{formatDate(r.scheduled_for!, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}</AppText>
              </Pressable>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={t('alertsCenter.markDone')} hitSlop={8} onPress={() => toggle.mutate({ id: r.id, done: true, notificationId: r.notification_id })}>
                <Icon name="check-box-outline-blank" color={colors.primary} />
              </Pressable>
            </View>
          ))}
          {dueVacc.map((v) => (
            <Pressable key={v.id} accessibilityRole="button" onPress={() => v.animal && router.push(`/livestock/animals/${v.animal.id}`)} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 56 }}>
              <Icon name="vaccines" color={vaccState(v, today()) === 'overdue' ? colors.error : colors.warning} />
              <View style={{ flex: 1 }}>
                <AppText variant="labelLg">{v.vaccine_name} · {v.animal?.name ?? v.animal?.tag_id ?? ''}</AppText>
                <AppText variant="bodySm" color={colors.textMuted}>{v.due_on ? formatDate(v.due_on, i18n.language) : ''}</AppText>
              </View>
            </Pressable>
          ))}
        </Card>
      ))}
    </Screen>
  );
}
