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

/** Daily feed rate (% of biomass) by average body weight — standard warm-water feeding chart. */
export const feedRatePct = (avgWeightG: number) => (avgWeightG < 5 ? 8 : avgWeightG < 20 ? 5 : avgWeightG < 100 ? 3 : avgWeightG < 300 ? 2 : 1.5);
/** Suggested feed per day (kg); halved when dissolved oxygen < 4 mg/L or water > 32 °C. */
export function feedAdvice(biomassKg: number | null, avgWeightG: number | null, doMgl?: number | null, tempC?: number | null) {
  if (!biomassKg || !avgWeightG) return null;
  const pct = feedRatePct(avgWeightG);
  const stress = (doMgl != null && doMgl < 4) || (tempC != null && tempC > 32);
  const kg = Math.round(biomassKg * (pct / 100) * (stress ? 0.5 : 1) * 10) / 10;
  return { pct, kg, perMeal: Math.round((kg / 3) * 10) / 10, reduced: stress };
}
/** Average daily gain (g/day) between the two latest samples and days to reach a target weight. */
export function growthRate(samples: { recorded_on: string; avg_weight_g: number }[], targetG?: number) {
  const s = [...samples].sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  if (s.length < 2) return null;
  const a = s[s.length - 2], b = s[s.length - 1];
  const days = (Date.parse(b.recorded_on) - Date.parse(a.recorded_on)) / 86_400_000;
  if (days <= 0) return null;
  const adg = Math.round(((b.avg_weight_g - a.avg_weight_g) / days) * 100) / 100;
  return { adg, current: b.avg_weight_g, daysToTarget: targetG && adg > 0 && targetG > b.avg_weight_g ? Math.ceil((targetG - b.avg_weight_g) / adg) : null };
}
/** Least-squares line through (x ms, y) points → value `hoursAhead` after the last point. */
export function projectLinear(points: { x: number; y: number }[], hoursAhead: number) {
  if (points.length < 3) return null;
  const n = points.length, mx = points.reduce((s, p) => s + p.x, 0) / n, my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (!sxx) return null;
  const slope = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
  const at = points[n - 1].x + hoursAhead * 3600_000;
  return { value: Math.round((my + slope * (at - mx)) * 100) / 100, perHour: Math.round(slope * 3600_000 * 1000) / 1000 };
}
