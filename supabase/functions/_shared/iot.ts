// Pure IoT logic shared by `ingest` and `devices` (no Deno APIs, Jest-testable).

export type SensorType = { code: string; unit: string; min_valid: number; max_valid: number };
export type Channel = { channel: string; kind: 'sensor' | 'actuator'; sensor_type: string | null; enabled: boolean; calibration_offset: number; calibration_scale: number; max_run_s: number | null };
export type Reading = { sensor_type: string; value: number; raw_value: number; recorded_at: string };
export type Payload = {
  readings?: { s?: unknown; v?: unknown; t?: unknown }[];
  battery?: unknown; rssi?: unknown; fw?: unknown;
  actuators?: Record<string, { state?: unknown; manual?: unknown }>;
  location?: { lat?: unknown; lon?: unknown; acc?: unknown };
  acks?: { id?: unknown; ok?: unknown; msg?: unknown }[];
};

export const MAX_READINGS = 100;
const MAX_AGE_MS = 7 * 86_400_000;      // devices may buffer up to a week while offline
const MAX_FUTURE_MS = 10 * 60_000;      // clock skew allowance

/**
 * Validate a device's readings: channel must exist and be enabled on this device (we never assume a sensor
 * the hardware does not have), timestamp sane, value numeric; then calibrate and check the physical range.
 */
export function validateReadings(p: Payload, channels: Channel[], types: Map<string, SensorType>, now = Date.now()) {
  const accepted: Reading[] = [];
  const rejected: { channel: string; reason: string; value?: number }[] = [];
  for (const r of (p.readings ?? []).slice(0, MAX_READINGS)) {
    const ch = channels.find((c) => c.channel === r?.s && c.kind === 'sensor');
    if (!ch || !ch.sensor_type) { rejected.push({ channel: String(r?.s), reason: 'unknown_channel' }); continue; }
    if (!ch.enabled) { rejected.push({ channel: ch.channel, reason: 'disabled' }); continue; }
    const raw = typeof r.v === 'number' ? r.v : NaN;
    if (!Number.isFinite(raw)) { rejected.push({ channel: ch.channel, reason: 'not_a_number' }); continue; }
    const t = r.t == null ? now : typeof r.t === 'number' ? r.t * 1000 : NaN;
    if (!Number.isFinite(t) || t > now + MAX_FUTURE_MS || t < now - MAX_AGE_MS) { rejected.push({ channel: ch.channel, reason: 'bad_time' }); continue; }
    const value = Math.round((raw * ch.calibration_scale + ch.calibration_offset) * 1000) / 1000;
    const st = types.get(ch.sensor_type)!;
    if (value < st.min_valid || value > st.max_valid) { rejected.push({ channel: ch.channel, reason: 'out_of_range', value }); continue; }
    accepted.push({ sensor_type: ch.sensor_type, value, raw_value: raw, recorded_at: new Date(t).toISOString() });
  }
  return { accepted, rejected, truncated: (p.readings?.length ?? 0) > MAX_READINGS };
}

/** Newest value per sensor type in a batch. */
export function latestByType(rs: Reading[]) {
  const m = new Map<string, Reading>();
  for (const r of rs) { const cur = m.get(r.sensor_type); if (!cur || r.recorded_at > cur.recorded_at) m.set(r.sensor_type, r); }
  return m;
}

export type Threshold = { sensor_type: string; min_value: number | null; max_value: number | null };
/** 'low' | 'high' when outside the threshold, null when inside. */
export function breach(t: Threshold, v: number): { kind: 'low' | 'high'; limit: number } | null {
  if (t.min_value != null && v < t.min_value) return { kind: 'low', limit: t.min_value };
  if (t.max_value != null && v > t.max_value) return { kind: 'high', limit: t.max_value };
  return null;
}

export type Rule = { id: string; sensor_type: string; operator: '<' | '>'; threshold: number; cooldown_min: number; last_fired_at: string | null };
export function ruleFires(r: Rule, v: number, now = Date.now()) {
  const hit = r.operator === '<' ? v < r.threshold : v > r.threshold;
  const cooled = !r.last_fired_at || now - Date.parse(r.last_fired_at) >= r.cooldown_min * 60_000;
  return hit && cooled;
}

/** Ray-casting point-in-polygon; polygon is [[lon,lat],...]. */
export function insidePolygon(lon: number, lat: number, poly: number[][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Pond sensor batch → a water_quality_records snapshot (null if no water parameters). */
const WQ: Record<string, string> = {
  water_do: 'dissolved_oxygen_mgl', water_temp: 'temperature_c', water_ph: 'ph', ammonia: 'ammonia_mgl',
  salinity: 'salinity_ppt', turbidity: 'turbidity_ntu', water_level: 'water_level_cm',
};
export function wqSnapshot(latest: Map<string, Reading>) {
  const row: Record<string, number | string> = {};
  let when = '';
  for (const [type, r] of latest) if (WQ[type]) { row[WQ[type]] = r.value; if (r.recorded_at > when) when = r.recorded_at; }
  return when ? { ...row, recorded_at: when } : null;
}

// Default alert limits created when a pond or field device is registered (the farmer can change them).
export const DEFAULT_THRESHOLDS: Record<string, { min?: number; max?: number }> = {
  water_do: { min: 4 }, water_ph: { min: 6.5, max: 9 }, water_temp: { min: 22, max: 34 }, ammonia: { max: 1 },
  soil_moisture: { min: 20 }, battery: { min: 15 },
};

// ---------- Multilingual alert text (notifications are written in the farmer's language) ----------
type L = 'en' | 'te' | 'hi';
const PARAM: Record<string, Record<L, string>> = {
  water_do: { en: 'Dissolved oxygen', te: 'కరిగిన ఆక్సిజన్', hi: 'घुलित ऑक्सीजन' },
  water_temp: { en: 'Water temperature', te: 'నీటి ఉష్ణోగ్రత', hi: 'पानी का तापमान' },
  water_ph: { en: 'Water pH', te: 'నీటి pH', hi: 'पानी का pH' },
  ammonia: { en: 'Ammonia', te: 'అమ్మోనియా', hi: 'अमोनिया' },
  turbidity: { en: 'Turbidity', te: 'నీటి మసక', hi: 'गंदलापन' },
  salinity: { en: 'Salinity', te: 'లవణీయత', hi: 'लवणता' },
  water_level: { en: 'Water level', te: 'నీటి మట్టం', hi: 'जल स्तर' },
  soil_moisture: { en: 'Soil moisture', te: 'నేల తేమ', hi: 'मिट्टी की नमी' },
  soil_temp: { en: 'Soil temperature', te: 'నేల ఉష్ణోగ్రత', hi: 'मिट्टी का तापमान' },
  soil_ph: { en: 'Soil pH', te: 'నేల pH', hi: 'मिट्टी का pH' },
  air_temp: { en: 'Air temperature', te: 'గాలి ఉష్ణోగ్రత', hi: 'हवा का तापमान' },
  air_humidity: { en: 'Humidity', te: 'తేమ', hi: 'नमी' },
  body_temp: { en: 'Body temperature', te: 'శరీర ఉష్ణోగ్రత', hi: 'शरीर का तापमान' },
  battery: { en: 'Battery', te: 'బ్యాటరీ', hi: 'बैटरी' },
};
const T = {
  low: { en: '{p} low: {v} (limit {l})', te: '{p} తక్కువ: {v} (పరిమితి {l})', hi: '{p} कम: {v} (सीमा {l})' },
  high: { en: '{p} high: {v} (limit {l})', te: '{p} ఎక్కువ: {v} (పరిమితి {l})', hi: '{p} अधिक: {v} (सीमा {l})' },
  offline: { en: '{d} is offline', te: '{d} ఆఫ్‌లైన్‌లో ఉంది', hi: '{d} ऑफ़लाइन है' },
  offline_body: { en: 'No data since {t}. Check power and network.', te: '{t} నుండి డేటా రాలేదు. పవర్, నెట్‌వర్క్ తనిఖీ చేయండి.', hi: '{t} से कोई डेटा नहीं। बिजली और नेटवर्क जाँचें।' },
  rejected: { en: '{d}: impossible {p} reading', te: '{d}: అసాధ్యమైన {p} రీడింగ్', hi: '{d}: असंभव {p} रीडिंग' },
  rejected_body: { en: 'Value {v} is outside what this sensor can measure — the sensor may be faulty or need calibration.', te: '{v} విలువ ఈ సెన్సార్ కొలవగల పరిధిలో లేదు — సెన్సార్ పాడై ఉండవచ్చు లేదా కాలిబ్రేషన్ అవసరం.', hi: 'मान {v} इस सेंसर की माप सीमा से बाहर है — सेंसर ख़राब हो सकता है या कैलिब्रेशन चाहिए।' },
  geofence: { en: '{d} left the safe area', te: '{d} సురక్షిత ప్రాంతం దాటింది', hi: '{d} सुरक्षित क्षेत्र से बाहर गया' },
  simulated: { en: ' (simulated)', te: ' (సిమ్యులేటెడ్)', hi: ' (सिम्युलेटेड)' },
} as const;
const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w)\}/g, (_, k) => String(v[k] ?? ''));
export function alertText(kind: keyof typeof T, lang: string, v: { p?: string; v?: number | string; l?: number | string; d?: string; t?: string }, simulated = false) {
  const lg: L = lang === 'te' || lang === 'hi' ? lang : 'en';
  const p = v.p ? PARAM[v.p]?.[lg] ?? v.p : '';
  return fill(T[kind][lg], { ...v, p } as Record<string, string | number>) + (simulated ? T.simulated[lg] : '');
}

// ---------- Simulator (development and demos; every value it makes is stored with source 'simulated') ----------
export const SCENARIOS = ['normal', 'low_oxygen', 'dry_soil', 'fever', 'sensor_fault'] as const;
export type Scenario = (typeof SCENARIOS)[number];
// [base, daily swing, noise]; the swing peaks mid-afternoon.
const SIM: Record<string, [number, number, number]> = {
  water_do: [6.2, 1.4, 0.2], water_temp: [28.5, 1.8, 0.2], water_ph: [7.8, 0.3, 0.05], ammonia: [0.25, 0.05, 0.03],
  turbidity: [28, 4, 2], water_level: [120, 1, 0.5], salinity: [4.5, 0.1, 0.1],
  soil_moisture: [34, -3, 1], soil_temp: [27, 4, 0.3], soil_ph: [6.8, 0, 0.05], soil_n: [180, 0, 5], soil_p: [22, 0, 1], soil_k: [140, 0, 4],
  air_temp: [28, 5, 0.5], air_humidity: [70, -15, 2], light: [30000, 30000, 2000], rainfall: [0, 0, 0], water_flow: [0, 0, 0],
  body_temp: [38.6, 0.3, 0.1], activity: [450, 300, 60], rumination: [25, 8, 3], battery: [88, 0, 0.3],
};
export function simulateValue(type: string, at: Date, scenario: Scenario = 'normal', rand = Math.random) {
  const [base, swing, noise] = SIM[type] ?? [0, 0, 0];
  const hour = at.getUTCHours() + 5.5 + at.getUTCMinutes() / 60;          // India time of day
  const cycle = Math.sin(((hour - 9) / 24) * 2 * Math.PI);                 // +1 around 15:00, −1 around 03:00
  let v = base + swing * cycle + (rand() * 2 - 1) * noise;
  if (type === 'light') v = Math.max(0, v);
  if (scenario === 'low_oxygen' && type === 'water_do') v = 2.8 + rand() * 0.4;
  if (scenario === 'dry_soil' && type === 'soil_moisture') v = 14 + rand() * 2;
  if (scenario === 'fever' && type === 'body_temp') v = 40.2 + rand() * 0.4;
  if (scenario === 'sensor_fault' && (type === 'water_ph' || type === 'soil_ph')) v = 17;  // impossible pH → rejected
  return Math.round(v * 100) / 100;
}

// Sensors a device kind carries by default (the owner can change them at registration).
export const KIND_SENSORS: Record<string, string[]> = {
  pond_node: ['water_do', 'water_temp', 'water_ph', 'turbidity', 'ammonia', 'water_level', 'salinity', 'battery'],
  field_node: ['soil_moisture', 'soil_temp', 'air_temp', 'air_humidity', 'soil_ph', 'light', 'rainfall', 'battery'],
  collar: ['body_temp', 'activity', 'rumination', 'battery'],
  controller: [],
  gateway: [],
};
