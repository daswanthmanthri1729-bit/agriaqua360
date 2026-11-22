// POST { kind: 'history', lat, lon, days? }  → NASA POWER hourly data rolled up per day, + same period last year
// POST { kind: 'soil', lat, lon }             → SoilGrids modelled soil properties (an estimate, ~250 m grid)
// Both are cached server-side; every response names its source so the app can label it.
import { cors, fail, json } from '../_shared/http.ts';
import { cached, caller, isLatLon, timedFetch, Upstream } from '../_shared/server.ts';
import { climateSummary, POWER_PARAMS, powerHourlyToDaily, shapeSoilGrids, SOIL_PROPS, textureClass } from '../_shared/environment.ts';

const POWER = 'https://power.larc.nasa.gov/api/temporal';
const ymd = (d: Date) => d.toISOString().slice(0, 10).replaceAll('-', '');
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

async function powerHourly(lat: number, lon: number, start: Date, end: Date) {
  const p = new URLSearchParams({
    parameters: POWER_PARAMS.join(','), community: 'AG', latitude: lat.toFixed(4), longitude: lon.toFixed(4),
    start: ymd(start), end: ymd(end), format: 'JSON', 'time-standard': 'LST',
  });
  const r = await timedFetch(`${POWER}/hourly/point?${p}`, {}, 25_000);
  if (!r.ok) throw new Upstream(`power ${r.status} ${(await r.text()).slice(0, 200)}`);
  return powerHourlyToDaily(await r.json());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (!(await caller(req))) return fail('unauthorized', 401);
  let b: { kind?: string; lat?: number; lon?: number; days?: number };
  try { b = await req.json(); } catch { return fail('bad_request'); }
  if (!isLatLon(b.lat, b.lon)) return fail('bad_request');
  const lat = b.lat, lon = b.lon!;

  try {
    if (b.kind === 'history') {
      const days = Math.min(90, Math.max(7, Math.round(Number(b.days) || 30)));
      // POWER's near-real-time data lags a few days; ask up to yesterday and keep what comes back.
      const end = addDays(new Date(), -1), start = addDays(end, -(days - 1));
      const grid = `${lat.toFixed(1)},${lon.toFixed(1)}`;
      const res = await cached(`nasa:${grid}:${ymd(start)}:${days}`, 6 * 3600_000, async () => {
        const [now, lastYear] = await Promise.all([
          powerHourly(lat, lon, start, end),
          powerHourly(lat, lon, addDays(start, -365), addDays(end, -365)).catch(() => []),
        ]);
        return {
          source: 'NASA POWER (MERRA-2 / CERES), hourly, ~50 km grid',
          units: { temp: '°C', humidity: '%', rain: 'mm', solar: 'kWh/m²', wind: 'm/s' },
          days: now,
          summary: climateSummary(now),
          last_year_summary: lastYear.length ? climateSummary(lastYear) : null,
          data_until: now.at(-1)?.date ?? null,
        };
      });
      return json({ ...res.data, cached: res.cached, fetched_at: res.fetched_at });
    }

    if (b.kind === 'soil') {
      const grid = `${lat.toFixed(3)},${lon.toFixed(3)}`; // ~100 m; SoilGrids cells are 250 m
      const res = await cached(`soil:${grid}`, 90 * 86_400_000, async () => {
        const p = new URLSearchParams({ lon: lon.toFixed(4), lat: lat.toFixed(4), value: 'mean' });
        SOIL_PROPS.forEach((x) => p.append('property', x));
        ['0-5cm', '5-15cm', '15-30cm'].forEach((x) => p.append('depth', x));
        const r = await timedFetch(`https://rest.isric.org/soilgrids/v2.0/properties/query?${p}`, {}, 25_000);
        if (!r.ok) throw new Upstream(`soilgrids ${r.status}`);
        const layers = shapeSoilGrids(await r.json());
        const top = (name: string) => layers.find((l) => l.property === name)?.depths.find((d) => d.depth === '0-5cm')?.value ?? null;
        const [sand, silt, clay] = [top('sand'), top('silt'), top('clay')];
        if (layers.every((l) => l.depths.every((d) => d.value == null))) throw new Upstream('soil_no_data'); // water, city, outside coverage
        return {
          source: 'ISRIC SoilGrids 2.0 (modelled estimate, 250 m)',
          layers,
          texture: sand != null && silt != null && clay != null ? textureClass(sand, silt, clay) : null,
        };
      });
      return json({ ...res.data, cached: res.cached, fetched_at: res.fetched_at });
    }
    return fail('bad_request');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('environment', b.kind, msg);
    return fail(msg === 'soil_no_data' ? 'soil_no_data' : 'data_unavailable', msg === 'soil_no_data' ? 404 : 502);
  }
});
