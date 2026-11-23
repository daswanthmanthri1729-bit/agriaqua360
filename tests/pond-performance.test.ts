import { pondPerformance } from '@/features/aquaculture/performance';

const r = (record_type: string, quantity: number | null, unit: string | null, avg_weight_g: number | null = null, recorded_on = '2026-11-01') => ({ record_type, quantity, unit, avg_weight_g, recorded_on }) as never;
it('computes survival, biomass and FCR from records', () => {
  const p = pondPerformance({ stocking_count: 999 }, [
    r('stocking', 10000, 'pcs'), r('mortality', 500, 'pcs'), r('feeding', 600, 'kg'), r('feeding', 400, 'kg'),
    r('sampling', null, null, 80, '2026-10-01'), r('sampling', null, null, 100, '2026-11-10'),
  ]);
  expect(p).toMatchObject({ stocked: 10000, dead: 500, alive: 9500, survivalPct: 95, avgWeightG: 100, biomassKg: 950, feedKg: 1000, fcr: 1.05 });
});
it('falls back to the pond stocking count and gives no FCR without a sample', () => {
  const p = pondPerformance({ stocking_count: 2000 }, [r('feeding', 50, 'kg')]);
  expect(p).toMatchObject({ stocked: 2000, survivalPct: 100, biomassKg: null, fcr: null });
});

import { feedAdvice, feedRatePct, growthRate, projectLinear } from '@/features/aquaculture/performance';
it('feed, growth and trend projection', () => {
  expect([feedRatePct(3), feedRatePct(50), feedRatePct(500)]).toEqual([8, 3, 1.5]);
  expect(feedAdvice(1000, 50)).toEqual({ pct: 3, kg: 30, perMeal: 10, reduced: false });
  expect(feedAdvice(1000, 50, 3.5)?.kg).toBe(15);
  expect(feedAdvice(null, 50)).toBeNull();
  expect(growthRate([{ recorded_on: '2026-10-01', avg_weight_g: 100 }, { recorded_on: '2026-10-11', avg_weight_g: 130 }], 250)).toEqual({ adg: 3, current: 130, daysToTarget: 40 });
  const h = 3600_000;
  expect(projectLinear([{ x: 0, y: 6 }, { x: h, y: 5.5 }, { x: 2 * h, y: 5 }], 2)).toEqual({ value: 4, perHour: -0.5 });
  expect(projectLinear([{ x: 0, y: 1 }], 1)).toBeNull();
});
