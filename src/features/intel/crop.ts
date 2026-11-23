// Pure crop-intelligence helpers (unit-tested). All outputs are estimates and the UI labels them so.
import type { GrowthStage, SoilTest } from '@/types/database';
import { rateNutrient, ratePh } from './agronomy';

// Typical field duration (days from sowing/transplanting to harvest) for common Indian crops.
const DURATION: Record<string, number> = {
  paddy: 120, rice: 120, maize: 110, corn: 110, cotton: 160, chilli: 150, chillies: 150, tomato: 110, groundnut: 110, wheat: 120,
  sugarcane: 360, turmeric: 240, onion: 120, potato: 100, banana: 330, 'red gram': 160, 'black gram': 80, 'green gram': 70, jowar: 110, bajra: 85, ragi: 110, soybean: 100, sunflower: 95, brinjal: 140, okra: 90,
};
export const cropDuration = (name: string) => DURATION[name.trim().toLowerCase()] ?? 120;

// Typical yield (quintal per acre) — national/regional averages, used only when the farmer has no own history.
const TYPICAL_YIELD: Record<string, number> = { paddy: 22, rice: 22, maize: 25, corn: 25, cotton: 8, chilli: 10, chillies: 10, groundnut: 8, tomato: 100, wheat: 18, onion: 80, potato: 90, 'red gram': 4, 'black gram': 4, 'green gram': 3.5, jowar: 8, bajra: 8, ragi: 8, soybean: 8, sunflower: 5 };
export const typicalYield = (name: string) => TYPICAL_YIELD[name.trim().toLowerCase()] ?? null;

const day = (s: string) => Date.parse(`${s}T00:00:00Z`);
/** Crop timeline from sowing date: progress 0–1, stage estimate, expected harvest date, days left. */
export function cropTimeline(c: { name: string; sowing_date: string | null; expected_harvest_date: string | null }, todayIso: string) {
  if (!c.sowing_date) return null;
  const total = c.expected_harvest_date ? Math.max(1, (day(c.expected_harvest_date) - day(c.sowing_date)) / 86_400_000) : cropDuration(c.name);
  const elapsed = Math.max(0, (day(todayIso) - day(c.sowing_date)) / 86_400_000);
  const progress = Math.min(1, elapsed / total);
  const stage: GrowthStage = progress < 0.1 ? 'germination' : progress < 0.45 ? 'vegetative' : progress < 0.65 ? 'flowering' : progress < 0.85 ? 'fruiting' : progress < 1 ? 'maturity' : 'harvest';
  const harvest = c.expected_harvest_date ?? new Date(day(c.sowing_date) + total * 86_400_000).toISOString().slice(0, 10);
  return { days: Math.round(elapsed), total: Math.round(total), progress: Math.round(progress * 100) / 100, stage, harvest, daysLeft: Math.max(0, Math.round(total - elapsed)) };
}

/** Growing degree days (base 10 °C) from daily min/max temperatures. */
export const gdd = (days: { temp_min: number | null; temp_max: number | null }[], base = 10) =>
  Math.round(days.reduce((s, d) => (d.temp_min == null || d.temp_max == null ? s : s + Math.max(0, (d.temp_min + d.temp_max) / 2 - base)), 0));

export type Risk = { kind: 'fungal' | 'bacterial' | 'sucking_pests' | 'caterpillars' | 'heat_stress'; level: 'low' | 'medium' | 'high'; hours: number };
/** Weather-driven crop risks for the next 48 h (standard agromet rules of thumb). */
export function weatherRisks(hourly: { temp: number; humidity: number; rain_mm: number }[]): Risk[] {
  const lvl = (h: number, med: number, high: number) => (h >= high ? 'high' : h >= med ? 'medium' : 'low') as Risk['level'];
  const wetWarm = hourly.filter((h) => h.humidity >= 85 && h.temp >= 20 && h.temp <= 30).length;
  const rainyWarm = hourly.filter((h) => h.rain_mm > 0.5 && h.temp >= 25).length;
  const hotDry = hourly.filter((h) => h.temp >= 33 && h.humidity < 45).length;
  const warmHumidNight = hourly.filter((h) => h.temp >= 24 && h.temp <= 30 && h.humidity >= 75).length;
  const heat = hourly.filter((h) => h.temp >= 38).length;
  return ([
    { kind: 'fungal', hours: wetWarm, level: lvl(wetWarm, 6, 12) },
    { kind: 'bacterial', hours: rainyWarm, level: lvl(rainyWarm, 3, 8) },
    { kind: 'sucking_pests', hours: hotDry, level: lvl(hotDry, 6, 14) },
    { kind: 'caterpillars', hours: warmHumidNight, level: lvl(warmHumidNight, 16, 30) },
    { kind: 'heat_stress', hours: heat, level: lvl(heat, 2, 6) },
  ] as Risk[]).sort((a, b) => ['high', 'medium', 'low'].indexOf(a.level) - ['high', 'medium', 'low'].indexOf(b.level));
}

/** Dry days in the forecast suitable for harvesting (little rain, low chance of rain). */
export const harvestWindows = (daily: { date: string; rain_mm: number; pop: number; wind_kmh: number }[]) =>
  daily.filter((d) => d.rain_mm < 2 && d.pop < 40 && d.wind_kmh < 40).map((d) => d.date);

/** Yield estimate (quintal): own history per acre when available, else the typical average; ±20 % band. */
export function yieldEstimate(cropName: string, areaAcres: number | null, history: { qtlPerAcre: number }[]) {
  if (!areaAcres) return null;
  const own = history.length ? history.reduce((s, h) => s + h.qtlPerAcre, 0) / history.length : null;
  const perAcre = own ?? typicalYield(cropName);
  if (perAcre == null) return null;
  const mid = perAcre * areaAcres;
  const r = (n: number) => Math.round(n * 10) / 10;
  return { basis: own != null ? 'own' as const : 'typical' as const, perAcre: r(perAcre), low: r(mid * 0.8), mid: r(mid), high: r(mid * 1.2), seasons: history.length };
}

/** Harvest quantity in quintals from a crop_records harvest row. */
export const toQuintal = (q: number | null, unit: string | null) => (q == null ? null : unit === 'kg' ? q / 100 : unit === 't' || unit === 'tonne' ? q * 10 : unit === 'qtl' || unit === 'q' || !unit ? q : null);

/** Fertiliser / amendment advice keys from a soil test (Soil Health Card style). */
export function soilAdvice(t: Pick<SoilTest, 'ph' | 'organic_carbon_pct' | 'nitrogen_kg_ha' | 'phosphorus_kg_ha' | 'potassium_kg_ha' | 'ec_dsm' | 'zinc_ppm'>): string[] {
  const out: string[] = [];
  const ph = ratePh(t.ph);
  if (ph === 'acidic') out.push('soilAi.adv.lime');
  if (ph === 'alkaline') out.push('soilAi.adv.gypsum');
  if (t.ec_dsm != null && t.ec_dsm > 3) out.push('soilAi.adv.salinity');
  if (rateNutrient('oc', t.organic_carbon_pct) === 'low') out.push('soilAi.adv.organic');
  if (rateNutrient('n', t.nitrogen_kg_ha) === 'low') out.push('soilAi.adv.nLow');
  if (rateNutrient('n', t.nitrogen_kg_ha) === 'high') out.push('soilAi.adv.nHigh');
  if (rateNutrient('p', t.phosphorus_kg_ha) === 'low') out.push('soilAi.adv.pLow');
  if (rateNutrient('k', t.potassium_kg_ha) === 'low') out.push('soilAi.adv.kLow');
  if (t.zinc_ppm != null && t.zinc_ppm < 0.6) out.push('soilAi.adv.zinc');
  if (!out.length) out.push('soilAi.adv.balanced');
  return out;
}

/** Kharif (Jun–Oct), Rabi (Nov–Mar) or Zaid (Apr–May) for a month 1–12. */
export const seasonOf = (month: number) => (month >= 6 && month <= 10 ? 'kharif' : month >= 4 && month <= 5 ? 'zaid' : 'rabi');
