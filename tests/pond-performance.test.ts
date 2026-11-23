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
