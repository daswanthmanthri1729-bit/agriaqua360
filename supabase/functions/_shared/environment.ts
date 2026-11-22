// Pure parsers for NASA POWER and SoilGrids (no Deno APIs, Jest-testable).

export const POWER_PARAMS = ['T2M', 'RH2M', 'PRECTOTCORR', 'ALLSKY_SFC_SW_DWN', 'WS2M'] as const;
type PowerParam = (typeof POWER_PARAMS)[number];
export type PowerResponse = {
  properties: { parameter: Record<PowerParam, Record<string, number>> };
  parameters?: Record<string, { units: string; longname: string }>;
};

export type ClimateDay = {
  date: string; temp_min: number | null; temp_max: number | null; temp_avg: number | null;
  humidity_avg: number | null; rain_mm: number | null; solar_kwh_m2: number | null; wind_ms_avg: number | null;
};

const ok = (v: number | undefined) => (v == null || v <= -998 ? null : v);  // POWER fill value is -999
const round = (v: number | null, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sum = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) : null);

/** Hourly POWER (keys YYYYMMDDHH) → one row per local day. Days with fewer than 18 valid hours of a value get null for it. */
export function powerHourlyToDaily(p: PowerResponse): ClimateDay[] {
  const P = p.properties.parameter;
  const byDay = new Map<string, Record<PowerParam, number[]>>();
  for (const key of Object.keys(P.T2M ?? {})) {
    const day = `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
    if (!byDay.has(day)) byDay.set(day, { T2M: [], RH2M: [], PRECTOTCORR: [], ALLSKY_SFC_SW_DWN: [], WS2M: [] });
    const row = byDay.get(day)!;
    for (const k of POWER_PARAMS) { const v = ok(P[k]?.[key]); if (v != null) row[k].push(v); }
  }
  const enough = (xs: number[]) => xs.length >= 18;
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, r]) => ({
    date,
    temp_min: enough(r.T2M) ? round(Math.min(...r.T2M)) : null,
    temp_max: enough(r.T2M) ? round(Math.max(...r.T2M)) : null,
    temp_avg: enough(r.T2M) ? round(avg(r.T2M)) : null,
    humidity_avg: enough(r.RH2M) ? round(avg(r.RH2M), 0) : null,
    rain_mm: enough(r.PRECTOTCORR) ? round(sum(r.PRECTOTCORR)) : null,
    // Hourly irradiance (W/m², hourly mean) summed over the day = Wh/m² → kWh/m².
    solar_kwh_m2: enough(r.ALLSKY_SFC_SW_DWN) ? round(sum(r.ALLSKY_SFC_SW_DWN)! / 1000, 2) : null,
    wind_ms_avg: enough(r.WS2M) ? round(avg(r.WS2M)) : null,
  })).filter((d) => d.temp_avg != null || d.rain_mm != null);
}

/** Totals over a daily series (nulls skipped, with the count of days that had data). */
export function climateSummary(days: ClimateDay[]) {
  const rain = days.map((d) => d.rain_mm).filter((v): v is number => v != null);
  const t = days.map((d) => d.temp_avg).filter((v): v is number => v != null);
  return {
    days_with_data: days.length,
    rain_total_mm: round(sum(rain) ?? null),
    rainy_days: rain.filter((v) => v >= 2.5).length,  // IMD "rainy day" threshold
    temp_avg: round(avg(t)),
    temp_max: days.reduce<number | null>((m, d) => (d.temp_max != null && (m == null || d.temp_max > m) ? d.temp_max : m), null),
    temp_min: days.reduce<number | null>((m, d) => (d.temp_min != null && (m == null || d.temp_min < m) ? d.temp_min : m), null),
  };
}

// ---------- SoilGrids ----------
export const SOIL_PROPS = ['phh2o', 'soc', 'nitrogen', 'clay', 'sand', 'silt', 'cec', 'bdod'] as const;
export type SoilGridsResponse = {
  properties: { layers: { name: string; unit_measure: { d_factor: number; target_units: string }; depths: { label: string; values: { mean: number | null } }[] }[] };
};
export type SoilLayer = { property: string; unit: string; depths: { depth: string; value: number | null }[] };

export function shapeSoilGrids(r: SoilGridsResponse): SoilLayer[] {
  return (r.properties?.layers ?? []).map((l) => ({
    property: l.name,
    unit: l.unit_measure.target_units,
    depths: l.depths.map((d) => ({ depth: d.label, value: d.values.mean == null ? null : Math.round((d.values.mean / l.unit_measure.d_factor) * 100) / 100 })),
  }));
}

/** USDA texture class from sand/silt/clay % (simplified triangle, enough to explain the soil to a farmer). */
export function textureClass(sand: number, silt: number, clay: number): string {
  if (clay >= 40) return silt >= 40 ? 'silty_clay' : sand > 45 ? 'sandy_clay' : 'clay';
  if (clay >= 27) return sand > 45 ? 'sandy_clay_loam' : silt >= 40 ? 'silty_clay_loam' : 'clay_loam';
  if (silt >= 80 && clay < 12) return 'silt';
  if (silt >= 50) return 'silt_loam';
  if (sand >= 85 && silt + 1.5 * clay < 15) return 'sand';
  if (sand >= 70 && clay < 20) return 'loamy_sand';
  if (clay >= 20 && sand > 45) return 'sandy_clay_loam';
  if (sand > 52 || (clay < 7 && silt < 50)) return 'sandy_loam';
  return 'loam';
}
