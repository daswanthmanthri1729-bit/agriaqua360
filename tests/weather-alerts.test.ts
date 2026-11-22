jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/services/notifications', () => ({ cancelReminders: jest.fn(), scheduleReminder: jest.fn() }));
import { planWeatherAlerts } from '@/services/weatherAlerts';

const T = '2026-11-22';
const adv = (kind: 'heavy_rain' | 'heat', date: string) => ({ kind, date, value: 30 });

it('warns the morning before, or today when the warning is for today', () => {
  const p = planWeatherAlerts([adv('heavy_rain', '2026-11-24'), adv('heat', '2026-11-22')], {}, T);
  expect(p.schedule.map((s) => [s.key, s.notifyOn])).toEqual([['heavy_rain:2026-11-24', '2026-11-23'], ['heat:2026-11-22', '2026-11-22']]);
  expect(p.cancel).toEqual([]);
});

it('does not schedule the same warning twice (even if it was saved in-app only)', () => {
  const p = planWeatherAlerts([adv('heavy_rain', '2026-11-24')], { 'heavy_rain:2026-11-24': null }, T);
  expect(p.schedule).toEqual([]);
});

it('cancels warnings that left the forecast or are in the past, ignores past advisories', () => {
  const p = planWeatherAlerts([adv('heat', '2026-11-21')], { 'heavy_rain:2026-11-24': 'n1', 'heat:2026-11-20': 'n0' }, T);
  expect(p.schedule).toEqual([]);
  expect(p.cancel.sort()).toEqual(['heat:2026-11-20', 'heavy_rain:2026-11-24']);
});
