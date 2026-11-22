// General pond guide ranges (Indian freshwater carp & brackish shrimp culture). Species differ, so the UI
// labels these as a guide; salinity is shown but not judged because the right value depends on the species.
export type Param = 'ph' | 'dissolved_oxygen_mgl' | 'temperature_c' | 'ammonia_mgl' | 'salinity_ppt' | 'turbidity_cm';
export type Level = 'ok' | 'warn' | 'bad';

type Range = { ok: [number, number]; warn: [number, number] };
export const RANGES: Partial<Record<Param, Range>> = {
  ph: { ok: [7.0, 8.5], warn: [6.5, 9.0] },
  dissolved_oxygen_mgl: { ok: [5, Infinity], warn: [3, Infinity] },
  temperature_c: { ok: [26, 32], warn: [22, 34] },
  ammonia_mgl: { ok: [0, 0.5], warn: [0, 1] },
  turbidity_cm: { ok: [30, 45], warn: [20, 60] }, // Secchi disc transparency
};

export const PARAMS: { key: Param; unit: string; max: number }[] = [
  { key: 'ph', unit: 'pH', max: 14 },
  { key: 'dissolved_oxygen_mgl', unit: 'mg/L', max: 30 },
  { key: 'temperature_c', unit: '°C', max: 50 },
  { key: 'ammonia_mgl', unit: 'mg/L', max: 20 },
  { key: 'salinity_ppt', unit: 'ppt', max: 60 },
  { key: 'turbidity_cm', unit: 'cm', max: 300 },
];

const within = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;

export function level(param: Param, value: number | null | undefined): Level | null {
  const r = RANGES[param];
  if (value == null || !r) return null;
  return within(value, r.ok) ? 'ok' : within(value, r.warn) ? 'warn' : 'bad';
}

/** Translation key for the advice line of an out-of-range reading, e.g. water.advice.dissolved_oxygen_mgl_low */
export function adviceKey(param: Param, value: number): string | null {
  const r = RANGES[param];
  if (!r || within(value, r.ok)) return null;
  return `water.advice.${param}_${value < r.ok[0] ? 'low' : 'high'}`;
}

/** Worst level across a reading (bad > warn > ok); null when nothing judgeable was entered. */
export function overall(reading: Partial<Record<Param, number | null>>): Level | null {
  const ls = (Object.keys(RANGES) as Param[]).map((p) => level(p, reading[p])).filter(Boolean) as Level[];
  return ls.includes('bad') ? 'bad' : ls.includes('warn') ? 'warn' : ls.length ? 'ok' : null;
}

export const rangeLabel = (param: Param) => {
  const r = RANGES[param];
  if (!r) return null;
  const [lo, hi] = r.ok;
  return hi === Infinity ? `> ${lo}` : lo === 0 ? `< ${hi}` : `${lo} – ${hi}`;
};
