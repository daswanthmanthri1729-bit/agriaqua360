import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { parseDate } from '@/lib/dates';
import { supabase } from '@/lib/supabase';
import { ensureNotificationChannel } from './permissions';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Local reminder at 7 AM on `date` (or in 1 min if that time has passed). No-op without permission or on web. */
export async function scheduleReminder(r: { date: string; title: string; body: string; route: string; category: string }) {
  const at = parseDate(r.date);
  at.setHours(7, 0, 0, 0);
  // In-app Notifications Centre copy (works even when phone notifications are off). Best effort.
  await supabase.from('notifications').insert({ category: r.category, title: r.title, body: r.body, route: r.route, scheduled_for: at.toISOString() }).then(() => {}, () => {});
  if (Platform.OS === 'web') return null;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return null;
    await ensureNotificationChannel();
    const when = at.getTime() > Date.now() ? at : new Date(Date.now() + 60_000);
    return await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body, data: { route: r.route, category: r.category } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'default' },
    });
  } catch {
    return null; // a failed reminder must never block saving the record
  }
}

/** Reminder taps deep-link to the record they're about (route in notification data). Native only. */
export function listenForNotificationTaps(open: (route: string) => void) {
  if (Platform.OS === 'web') return () => {};
  const go = (r?: Notifications.NotificationResponse | null) => {
    const route = r?.notification.request.content.data?.route;
    if (typeof route === 'string' && route.startsWith('/')) open(route);
  };
  Notifications.getLastNotificationResponseAsync().then(go).catch(() => {}); // app cold-started from a tap
  const sub = Notifications.addNotificationResponseReceivedListener(go);
  return () => sub.remove();
}

export async function cancelReminders(ids: (string | null | undefined)[]) {
  if (Platform.OS === 'web') return;
  await Promise.all(ids.filter((id): id is string => !!id).map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
}

/** Saves this phone's FCM token so the server can push weather/AI alerts. Silent no-op without permission or FCM config. */
export async function registerPushToken(userId: string) {
  if (Platform.OS !== 'android') return;
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    const { data } = await Notifications.getDevicePushTokenAsync();
    if (typeof data === 'string') await supabase.from('profiles').update({ push_token: data }).eq('id', userId);
  } catch {
    // Missing google-services.json in a dev build, or no Play Services: push stays off, local reminders still work.
  }
}
