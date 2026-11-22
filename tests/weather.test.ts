import { advisories, shape, toDaily, Forecast3h } from '../supabase/functions/_shared/weather';

const slot = (iso: string, o: Partial<{ min: number; max: number; main: string; icon: string; pop: number; rain: number; wind: number }> = {}): Forecast3h => ({
  dt: Date.parse(iso) / 1000,
  main: { temp_min: o.min ?? 25, temp_max: o.max ?? 30, humidity: 70 },
  weather: [{ main: o.main ?? 'Clouds', icon: o.icon ?? '03d' }],
  pop: o.pop ?? 0.1,
  rain: o.rain ? { '3h': o.rain } : undefined,
  wind: { speed: o.wind ?? 3 },
});
const IST = 19800;

describe('toDaily', () => {
  it('groups 3h slots by local (IST) day', () => {
    // 20:00 UTC = 01:30 IST next day
    const days = toDaily([slot('2026-11-22T06:00:00Z'), slot('2026-11-22T20:00:00Z')], IST);
    expect(days.map((d) => d.date)).toEqual(['2026-11-22', '2026-11-23']);
  });
  it('aggregates min/max/pop/rain/wind and picks the dominant condition', () => {
    const [d] = toDaily([
      slot('2026-11-22T03:00:00Z', { min: 21.4, max: 28, main: 'Rain', icon: '10d', pop: 0.8, rain: 12.25, wind: 5 }),
      slot('2026-11-22T06:00:00Z', { min: 23, max: 33.6, main: 'Rain', icon: '10d', pop: 0.6, rain: 9 }),
      slot('2026-11-22T09:00:00Z', { main: 'Clouds' }),
    ], IST);
    expect(d).toMatchObject({ min: 21, max: 34, pop: 80, rain_mm: 21.3, condition: 'Rain', icon: '10d', wind_kmh: 18 });
  });
});

describe('advisories', () => {
  it('flags heavy rain, heat, wind and cold at thresholds', () => {
    const base = { date: '2026-11-22', min: 20, max: 30, pop: 0, rain_mm: 0, condition: 'Clear', icon: '01d', wind_kmh: 10 };
    expect(advisories([base])).toEqual([]);
    expect(advisories([{ ...base, rain_mm: 20, max: 40, wind_kmh: 40, min: 8 }]).map((a) => a.kind)).toEqual(['heavy_rain', 'heat', 'strong_wind', 'cold']);
  });
});

it('shape() builds current conditions with today rain chance', () => {
  const current = { name: 'Eluru', coord: { lat: 16.7, lon: 81.1 }, timezone: IST, dt: 1795000000, main: { temp: 30.6, feels_like: 34.2, humidity: 78 }, weather: [{ main: 'Clear', icon: '01d' }], wind: { speed: 3.4 } };
  const out = shape(current, [slot('2026-11-22T06:00:00Z', { pop: 0.15 })]);
  expect(out.current).toMatchObject({ temp: 31, feels_like: 34, humidity: 78, wind_kmh: 12, condition: 'Clear', pop_today: 15, rain_1h_mm: 0 });
  expect(out.location.name).toBe('Eluru');
});
