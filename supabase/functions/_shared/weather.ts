// Pure OpenWeather (2.5 free tier) → app shape. No Deno APIs so Jest can test it.
export type Forecast3h = { dt: number; main: { temp_min: number; temp_max: number; humidity: number }; weather: { main: string; icon: string }[]; pop?: number; rain?: { '3h'?: number }; wind: { speed: number } };
export type CurrentOW = { name: string; coord: { lat: number; lon: number }; timezone: number; dt: number; main: { temp: number; feels_like: number; humidity: number }; weather: { main: string; icon: string }[]; wind: { speed: number }; rain?: { '1h'?: number } };

export type Day = { date: string; min: number; max: number; pop: number; rain_mm: number; condition: string; icon: string; wind_kmh: number };
export type Advisory = { kind: 'heavy_rain' | 'heat' | 'strong_wind' | 'cold'; date: string; value: number };

const kmh = (ms: number) => Math.round(ms * 3.6);

export function toDaily(list: Forecast3h[], tzOffsetSec: number): Day[] {
  const days = new Map<string, Forecast3h[]>();
  for (const f of list) {
    const date = new Date((f.dt + tzOffsetSec) * 1000).toISOString().slice(0, 10);
    days.set(date, [...(days.get(date) ?? []), f]);
  }
  return [...days.entries()].map(([date, items]) => {
    // Most frequent condition across the day's 3h slots, preferring daytime icons.
    const counts = new Map<string, number>();
    items.forEach((i) => counts.set(i.weather[0].main, (counts.get(i.weather[0].main) ?? 0) + 1));
    const condition = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const icon = (items.find((i) => i.weather[0].main === condition && i.weather[0].icon.endsWith('d')) ?? items[0]).weather[0].icon;
    return {
      date,
      min: Math.round(Math.min(...items.map((i) => i.main.temp_min))),
      max: Math.round(Math.max(...items.map((i) => i.main.temp_max))),
      pop: Math.round(Math.max(...items.map((i) => i.pop ?? 0)) * 100),
      rain_mm: Math.round(items.reduce((s, i) => s + (i.rain?.['3h'] ?? 0), 0) * 10) / 10,
      condition,
      icon,
      wind_kmh: Math.max(...items.map((i) => kmh(i.wind.speed))),
    };
  });
}

// App-derived farm advisories from forecast thresholds (not official IMD warnings; the UI says so).
export function advisories(days: Day[]): Advisory[] {
  const out: Advisory[] = [];
  for (const d of days) {
    if (d.rain_mm >= 20) out.push({ kind: 'heavy_rain', date: d.date, value: d.rain_mm });
    if (d.max >= 40) out.push({ kind: 'heat', date: d.date, value: d.max });
    if (d.wind_kmh >= 40) out.push({ kind: 'strong_wind', date: d.date, value: d.wind_kmh });
    if (d.min <= 8) out.push({ kind: 'cold', date: d.date, value: d.min });
  }
  return out;
}

export function shape(current: CurrentOW, forecast: Forecast3h[]) {
  const daily = toDaily(forecast, current.timezone);
  return {
    location: { name: current.name, lat: current.coord.lat, lon: current.coord.lon },
    observed_at: new Date(current.dt * 1000).toISOString(),
    current: {
      temp: Math.round(current.main.temp),
      feels_like: Math.round(current.main.feels_like),
      humidity: current.main.humidity,
      wind_kmh: kmh(current.wind.speed),
      rain_1h_mm: current.rain?.['1h'] ?? 0,
      condition: current.weather[0]?.main ?? 'Clear',
      icon: current.weather[0]?.icon ?? '01d',
      pop_today: daily[0]?.pop ?? 0,
    },
    daily,
    advisories: advisories(daily),
  };
}

export const WEATHER_TTL_MS = 30 * 60_000;

/** Cache key: ~11 km grid cell for coordinates, normalised name for city searches. null = not cacheable. */
export function weatherCacheKey(q: { lat?: unknown; lon?: unknown; city?: unknown }): string | null {
  if (typeof q.city === 'string' && q.city.trim()) {
    return `c:${q.city.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').slice(0, 100)}`;
  }
  if (typeof q.lat === 'number' && typeof q.lon === 'number' && Math.abs(q.lat) <= 90 && Math.abs(q.lon) <= 180) {
    return `g:${q.lat.toFixed(1)},${q.lon.toFixed(1)}`;
  }
  return null;
}
