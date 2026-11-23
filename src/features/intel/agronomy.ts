// Pure agronomy helpers (unit-tested). Sources: Soil Health Card rating norms (Govt. of India) and FAO-56 crop coefficients.
import type { GrowthStage } from '@/types/database';

export type Rating = 'low' | 'medium' | 'high';
/** Soil Health Card ratings for available N, P, K (kg/ha) and organic carbon (%). */
export function rateNutrient(k: 'n' | 'p' | 'k' | 'oc', v: number | null | undefined): Rating | null {
  if (v == null) return null;
  const [lo, hi] = { n: [280, 560], p: [10, 25], k: [108, 280], oc: [0.5, 0.75] }[k];
  return v < lo ? 'low' : v > hi ? 'high' : 'medium';
}
export const ratePh = (ph: number | null | undefined) => (ph == null ? null : ph < 6.5 ? 'acidic' : ph > 7.5 ? 'alkaline' : 'neutral');
export const rateEc = (ec: number | null | undefined) => (ec == null ? null : ec < 1 ? 'normal' : ec <= 3 ? 'caution' : 'harmful');

// ---------- irrigation (FAO-56, simplified) ----------
const KC_DEFAULT: Record<GrowthStage, number> = { germination: 0.4, vegetative: 0.75, flowering: 1.1, fruiting: 1.1, maturity: 0.8, harvest: 0.5 };
const KC_CROP: Record<string, Partial<Record<GrowthStage, number>>> = {
  paddy: { germination: 1.05, vegetative: 1.1, flowering: 1.2, fruiting: 1.2, maturity: 0.9, harvest: 0.6 },
  rice: { germination: 1.05, vegetative: 1.1, flowering: 1.2, fruiting: 1.2, maturity: 0.9, harvest: 0.6 },
  sugarcane: { germination: 0.4, vegetative: 1.0, flowering: 1.25, fruiting: 1.25, maturity: 0.75, harvest: 0.75 },
  cotton: { germination: 0.35, vegetative: 0.8, flowering: 1.15, fruiting: 1.15, maturity: 0.7, harvest: 0.5 },
  maize: { germination: 0.3, vegetative: 0.8, flowering: 1.2, fruiting: 1.2, maturity: 0.6, harvest: 0.35 },
  chilli: { germination: 0.6, vegetative: 0.8, flowering: 1.05, fruiting: 1.05, maturity: 0.9, harvest: 0.9 },
  tomato: { germination: 0.6, vegetative: 0.85, flowering: 1.15, fruiting: 1.15, maturity: 0.8, harvest: 0.7 },
  groundnut: { germination: 0.4, vegetative: 0.75, flowering: 1.15, fruiting: 1.15, maturity: 0.6, harvest: 0.6 },
};
export const kc = (crop: string, stage: GrowthStage | null | undefined) => KC_CROP[crop.trim().toLowerCase()]?.[stage ?? 'vegetative'] ?? KC_DEFAULT[stage ?? 'vegetative'];

export type IrrigationAdvice = {
  decision: 'irrigate_today' | 'irrigate_soon' | 'wait_rain' | 'not_needed';
  kc: number; etc_mm: number; rain_mm: number; effective_rain_mm: number; need_mm: number; litres: number | null; days: number;
  reasons: string[];  // translation keys
};
/**
 * Next-`days` water need: ETc = Kc × ET0 (Open-Meteo FAO-56 ET0), minus 80 % of forecast rain on days with ≥ 5 mm.
 * A live soil-moisture reading, when present, overrides: < 25 % → irrigate today, > 40 % → not needed.
 */
export function irrigationAdvice(p: { crop: string; stage?: GrowthStage | null; et0: number[]; rain: number[]; areaAcres?: number | null; soilMoisturePct?: number | null; days?: number }): IrrigationAdvice {
  const days = Math.min(p.days ?? 3, p.et0.length);
  const k = kc(p.crop, p.stage);
  const etc = p.et0.slice(0, days).reduce((s, e) => s + k * e, 0);
  const rain = p.rain.slice(0, days).reduce((s, r) => s + r, 0);
  const eff = p.rain.slice(0, days).reduce((s, r) => s + (r >= 5 ? 0.8 * r : 0), 0);
  const need = Math.max(0, etc - eff);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const reasons: string[] = [];
  let decision: IrrigationAdvice['decision'];
  const rainSoon = p.rain.slice(0, 2).reduce((s, r) => s + r, 0);
  if (p.soilMoisturePct != null && p.soilMoisturePct < 25) { decision = rainSoon >= 15 ? 'irrigate_soon' : 'irrigate_today'; reasons.push('irrigation.why.dry'); }
  else if (p.soilMoisturePct != null && p.soilMoisturePct > 40) { decision = 'not_needed'; reasons.push('irrigation.why.wet'); }
  else if (rainSoon >= 10) { decision = 'wait_rain'; reasons.push('irrigation.why.rain'); }
  else if (need >= 10) { decision = 'irrigate_today'; reasons.push('irrigation.why.need'); }
  else if (need >= 4) { decision = 'irrigate_soon'; reasons.push('irrigation.why.some'); }
  else { decision = 'not_needed'; reasons.push('irrigation.why.low'); }
  if (p.soilMoisturePct == null) reasons.push('irrigation.why.noSensor');
  return {
    decision, kc: k, etc_mm: r1(etc), rain_mm: r1(rain), effective_rain_mm: r1(eff), need_mm: r1(need), days, reasons,
    litres: p.areaAcres ? Math.round(need * p.areaAcres * 4046.86) : null,   // 1 mm over 1 m² = 1 L
  };
}

/** NDVI → plain-language vegetation class. */
export const ndviClass = (v: number | null | undefined) => (v == null ? null : v < 0.2 ? 'bare' : v < 0.4 ? 'sparse' : v < 0.6 ? 'moderate' : 'dense');

// ---------- weather → farm advice ----------
type Hour = { time: string; pop: number; rain_mm: number; wind_kmh: number };
/** First daytime window of ≥ 3 dry, calm hours (rain chance ≤ 20 %, wind ≤ 15 km/h): good for spraying. */
export function sprayWindow(hourly: Hour[]): { from: string; to: string } | null {
  let start = -1;
  for (let i = 0; i < hourly.length; i++) {
    const h = hourly[i], hr = Number(h.time.slice(11, 13));
    const ok = hr >= 6 && hr <= 18 && h.pop <= 20 && h.rain_mm === 0 && h.wind_kmh <= 15;
    if (ok && start < 0) start = i;
    if ((!ok || i === hourly.length - 1) && start >= 0) {
      const end = ok ? i : i - 1;
      if (end - start + 1 >= 3) return { from: hourly[start].time, to: hourly[end].time };
      start = -1;
    }
  }
  return null;
}
/** How the coming days' weather can affect pond oxygen (hot water and cloudy, rainy days lower dissolved oxygen). */
export function pondImpact(daily: { date: string; max: number; rain_mm: number }[]): { kind: 'heat' | 'cloudy_rain'; date: string } | null {
  for (const d of daily.slice(0, 3)) {
    if (d.max >= 34) return { kind: 'heat', date: d.date };
    if (d.rain_mm >= 20) return { kind: 'cloudy_rain', date: d.date };
  }
  return null;
}
