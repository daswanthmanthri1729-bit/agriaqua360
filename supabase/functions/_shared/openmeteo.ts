// Pure Open-Meteo → app weather shape (same shape as the OpenWeather path, plus hourly, ET0 and solar).
// No Deno APIs so Jest can test it.
import { advisories, Day } from './weather.ts';

export const OPEN_METEO_PARAMS = {
  current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day',
  hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,is_day,soil_moisture_0_to_1cm,soil_moisture_3_to_9cm',
  daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,et0_fao_evapotranspiration,shortwave_radiation_sum,uv_index_max',
};

/** WMO weather code → the OpenWeather-style condition + icon the app already renders. */
export function wmo(code: number, isDay = true): { condition: string; icon: string } {
  const d = isDay ? 'd' : 'n';
  if (code === 0) return { condition: 'Clear', icon: `01${d}` };
  if (code === 1) return { condition: 'Clear', icon: `02${d}` };
  if (code === 2) return { condition: 'Clouds', icon: `03${d}` };
  if (code === 3) return { condition: 'Clouds', icon: `04${d}` };
  if (code === 45 || code === 48) return { condition: 'Mist', icon: `50${d}` };
  if (code >= 51 && code <= 57) return { condition: 'Drizzle', icon: `09${d}` };
  if ((code >= 61 && code <= 67)) return { condition: 'Rain', icon: `10${d}` };
  if (code >= 80 && code <= 82) return { condition: 'Rain', icon: `09${d}` };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { condition: 'Snow', icon: `13${d}` };
  if (code >= 95) return { condition: 'Thunderstorm', icon: `11${d}` };
  return { condition: 'Clouds', icon: `03${d}` };
}

type Series = Record<string, (number | null)[]> & { time: string[] };
export type OpenMeteo = {
  latitude: number; longitude: number; utc_offset_seconds: number;
  current: Record<string, number> & { time: string };
  hourly: Series; daily: Series;
};

const r1 = (n: number | null | undefined) => (n == null ? 0 : Math.round(n * 10) / 10);
const n0 = (n: number | null | undefined) => (n == null ? 0 : Math.round(n));

export function shapeOpenMeteo(m: OpenMeteo, name: string) {
  const daily: (Day & { et0_mm: number; solar_mj: number; uv: number })[] = m.daily.time.map((date, i) => ({
    date,
    min: n0(m.daily.temperature_2m_min[i]),
    max: n0(m.daily.temperature_2m_max[i]),
    pop: n0(m.daily.precipitation_probability_max[i]),
    rain_mm: r1(m.daily.precipitation_sum[i]),
    ...wmo(m.daily.weather_code[i] ?? 3),
    wind_kmh: n0(m.daily.wind_speed_10m_max[i]),
    et0_mm: r1(m.daily.et0_fao_evapotranspiration[i]),
    solar_mj: r1(m.daily.shortwave_radiation_sum[i]),
    uv: r1(m.daily.uv_index_max[i]),
  }));
  // Next 48 hours from the current hour.
  const nowIdx = Math.max(0, m.hourly.time.findIndex((t) => t >= m.current.time.slice(0, 13)));
  const hourly = m.hourly.time.slice(nowIdx, nowIdx + 48).map((time, k) => {
    const i = nowIdx + k;
    return {
      time,
      temp: n0(m.hourly.temperature_2m[i]),
      humidity: n0(m.hourly.relative_humidity_2m[i]),
      pop: n0(m.hourly.precipitation_probability[i]),
      rain_mm: r1(m.hourly.precipitation[i]),
      wind_kmh: n0(m.hourly.wind_speed_10m[i]),
      ...wmo(m.hourly.weather_code[i] ?? 3, m.hourly.is_day[i] !== 0),
    };
  });
  const sm = (k: string) => m.hourly[k]?.[nowIdx];
  const c = m.current;
  return {
    source: 'open-meteo',
    location: { name, lat: m.latitude, lon: m.longitude },
    // Open-Meteo gives local time without an offset; convert so the app can say "updated x min ago".
    observed_at: new Date(Date.parse(`${c.time}:00Z`) - m.utc_offset_seconds * 1000).toISOString(),
    current: {
      temp: n0(c.temperature_2m),
      feels_like: n0(c.apparent_temperature),
      humidity: n0(c.relative_humidity_2m),
      wind_kmh: n0(c.wind_speed_10m),
      rain_1h_mm: r1(c.precipitation),
      ...wmo(c.weather_code, c.is_day !== 0),
      pop_today: daily[0]?.pop ?? 0,
    },
    daily,
    hourly,
    // Model estimate (not a sensor): volumetric soil water, m³/m³ → %.
    soil_moisture_estimate: sm('soil_moisture_0_to_1cm') == null ? null : {
      top_1cm_pct: r1((sm('soil_moisture_0_to_1cm') as number) * 100),
      cm_3_9_pct: sm('soil_moisture_3_to_9cm') == null ? null : r1((sm('soil_moisture_3_to_9cm') as number) * 100),
    },
    advisories: advisories(daily),
  };
}
