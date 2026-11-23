import { anomaly, feedPerLitre, milkTrend } from '@/features/livestock/insights';

const H = 3600_000, now = Date.parse('2026-11-23T12:00:00Z');
const series = (base: number, recent: number) => [
  ...Array.from({ length: 24 }, (_, i) => ({ x: now - (48 + i) * H, y: base })),
  ...Array.from({ length: 12 }, (_, i) => ({ x: now - i * H, y: recent })),
];
it('flags activity drops and rises against the animal’s own baseline', () => {
  expect(anomaly(series(400, 200), 24, now)).toMatchObject({ change: -50, flag: 'drop' });
  expect(anomaly(series(400, 700), 24, now)?.flag).toBe('rise');
  expect(anomaly(series(400, 420), 24, now)?.flag).toBeNull();
  expect(anomaly(series(400, 400).slice(0, 4), 24, now)).toBeNull();
});
it('milk trend and feed efficiency', () => {
  const t = milkTrend([{ date: 'a', litres: 10 }, { date: 'b', litres: 9 }, { date: 'c', litres: 8 }]);
  expect(t).toMatchObject({ avg: 9, perDay: -1 });
  expect(t!.next7).toBeGreaterThanOrEqual(0);
  expect(feedPerLitre(30, 60)).toBe(0.5);
  expect(feedPerLitre(0, 60)).toBeNull();
});
