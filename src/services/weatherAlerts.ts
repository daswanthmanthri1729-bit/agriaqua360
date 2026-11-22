import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Weather } from '@/features/weather/api';
import { addDays, today } from '@/lib/dates';
import { cancelReminders, scheduleReminder } from './notifications';

type Advisory = Weather['advisories'][number];
type Stored = Record<string, string | null>; // "kind:date" → phone notification id (null = saved in-app only)
const KEY = 'agriaqua-weather-alerts';

/** Pure: which advisories to schedule (and for which day) and which old ones to cancel. */
export function planWeatherAlerts(advisories: Advisory[], stored: Stored, now: string) {
  const current = new Map(advisories.filter((a) => a.date >= now).map((a) => [`${a.kind}:${a.date}`, a]));
  return {
    // Warn the morning before so farmers can prepare; same day if "before" has already passed.
    schedule: [...current].filter(([k]) => !(k in stored)).map(([key, a]) => ({ key, advisory: a, notifyOn: addDays(a.date, -1) < now ? now : addDays(a.date, -1) })),
    // Forecast no longer shows it (or it's in the past): stop the phone alert.
    cancel: Object.keys(stored).filter((k) => !current.has(k)),
  };
}

/** Called when the dashboard gets a fresh forecast. Never throws: alerts must not break the app. */
export async function syncWeatherAlerts(advisories: Advisory[], text: (a: Advisory) => { title: string; body: string }) {
  try {
    const stored: Stored = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
    const plan = planWeatherAlerts(advisories, stored, today());
    if (!plan.schedule.length && !plan.cancel.length) return;
    await cancelReminders(plan.cancel.map((k) => stored[k]));
    plan.cancel.forEach((k) => delete stored[k]);
    for (const s of plan.schedule) {
      // shortcut: the in-app Notifications Centre keeps a cancelled warning's row; fine for a daily forecast, clean up if it confuses farmers.
      stored[s.key] = await scheduleReminder({ date: s.notifyOn, ...text(s.advisory), route: '/agriculture/weather', category: 'weather' });
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // ignore: the warning is still shown on the dashboard
  }
}
