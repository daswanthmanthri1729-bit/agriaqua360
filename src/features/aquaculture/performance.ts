import type { FishRecord, Pond } from '@/types/database';

/**
 * Pond performance from the farmer's own records. Biomass and FCR are estimates: biomass = live fish × latest
 * sample weight; FCR = feed given ÷ biomass gained (stocking weight assumed negligible).
 */
export function pondPerformance(pond: Pick<Pond, 'stocking_count'>, records: Pick<FishRecord, 'record_type' | 'quantity' | 'unit' | 'avg_weight_g' | 'recorded_on'>[]) {
  const pcs = (r: { quantity: number | null; unit: string | null }) => (r.unit === 'pcs' ? Number(r.quantity ?? 0) : 0);
  const stockedRecords = records.filter((r) => r.record_type === 'stocking').reduce((s, r) => s + pcs(r), 0);
  const stocked = stockedRecords || pond.stocking_count || 0;
  const dead = records.filter((r) => r.record_type === 'mortality').reduce((s, r) => s + pcs(r), 0);
  const harvested = records.filter((r) => r.record_type === 'harvest').reduce((s, r) => s + pcs(r), 0);
  const feedKg = records.filter((r) => r.record_type === 'feeding' && r.unit === 'kg').reduce((s, r) => s + Number(r.quantity ?? 0), 0);
  const sample = [...records].filter((r) => r.record_type === 'sampling' && r.avg_weight_g != null).sort((a, b) => b.recorded_on.localeCompare(a.recorded_on))[0];
  const alive = Math.max(0, stocked - dead - harvested);
  const biomassKg = sample ? Math.round((alive * Number(sample.avg_weight_g)) / 1000) : null;
  return {
    stocked, dead, alive, feedKg: Math.round(feedKg),
    survivalPct: stocked ? Math.round(((stocked - dead) / stocked) * 1000) / 10 : null,
    avgWeightG: sample ? Number(sample.avg_weight_g) : null,
    biomassKg,
    fcr: biomassKg && feedKg ? Math.round((feedKg / biomassKg) * 100) / 100 : null,
  };
}
