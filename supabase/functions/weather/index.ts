// POST { lat, lon, name? } | { city }  →  current conditions, hourly (48 h) and 7-day forecast, ET0, advisories.
// Open-Meteo (free, no key) first; OpenWeather is the fallback when Open-Meteo is down and a key is set.
import { cors, fail, json } from '../_shared/http.ts';
import { shape, WEATHER_TTL_MS, weatherCacheKey } from '../_shared/weather.ts';
import { OPEN_METEO_PARAMS, shapeOpenMeteo } from '../_shared/openmeteo.ts';
import { cached, isLatLon, timedFetch, Upstream } from '../_shared/server.ts';

const OW = 'https://api.openweathermap.org';
const UA = { 'User-Agent': 'AgriAqua360/2.0 (server; weather)' };

async function geocode(city: string) {
  // The v1 app sends "Village,IN": the part after the last comma is a country code.
  const m = city.match(/^(.*?),\s*([A-Za-z]{2})$/);
  const q = new URLSearchParams({ count: '1', format: 'json', name: (m ? m[1] : city).slice(0, 80), ...(m ? { countryCode: m[2].toUpperCase() } : {}) });
  const r = await timedFetch(`https://geocoding-api.open-meteo.com/v1/search?${q}`, {}, 8000);
  const hit = r.ok ? (await r.json()).results?.[0] : null;
  return hit ? { lat: hit.latitude as number, lon: hit.longitude as number, name: [hit.name, hit.admin1].filter(Boolean).join(', ') } : null;
}

// Place name for coordinates: OpenStreetMap Nominatim, then Photon (also OSM). Empty if both fail.
async function placeName(lat: number, lon: number) {
  try {
    const r = await timedFetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lon}`, { headers: UA }, 4000);
    const a = r.ok ? (await r.json()).address ?? {} : {};
    const n = a.city ?? a.town ?? a.village ?? a.county ?? a.state_district ?? a.state;
    if (n) return n as string;
    console.warn('nominatim', r.status);
  } catch (e) { console.warn('nominatim', String(e)); }
  try {
    const r = await timedFetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1`, { headers: UA }, 4000);
    const p = r.ok ? (await r.json()).features?.[0]?.properties ?? {} : {};
    return (p.city ?? p.town ?? p.village ?? p.county ?? p.district ?? p.state ?? '') as string;
  } catch (e) { console.warn('photon', String(e)); return ''; }
}

async function openMeteo(lat: number, lon: number, name: string) {
  const p = new URLSearchParams({ latitude: String(lat), longitude: String(lon), timezone: 'auto', forecast_days: '7', ...OPEN_METEO_PARAMS });
  const [r, place] = await Promise.all([timedFetch(`https://api.open-meteo.com/v1/forecast?${p}`), name ? Promise.resolve(name) : placeName(lat, lon)]);
  if (!r.ok) throw new Upstream(`open-meteo ${r.status}`);
  return shapeOpenMeteo(await r.json(), place);
}

async function openWeather(lat: number, lon: number, key: string) {
  const qs = `lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
  const [c, f] = await Promise.all([timedFetch(`${OW}/data/2.5/weather?${qs}`), timedFetch(`${OW}/data/2.5/forecast?${qs}`)]);
  if (!c.ok || !f.ok) throw new Upstream(`openweather ${c.status}/${f.status}`);
  const [current, forecast] = await Promise.all([c.json(), f.json()]);
  return { source: 'openweather', ...shape(current, forecast.list) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  let body: { lat?: number; lon?: number; city?: string; name?: string };
  try { body = await req.json(); } catch { return fail('bad_request'); }
  const cacheKey = weatherCacheKey(body);
  if (!cacheKey) return fail('bad_request');

  try {
    const res = await cached(`w2:${cacheKey}`, WEATHER_TTL_MS, async () => {
      let { lat, lon } = body;
      // The app may send the place name it already knows (from the phone's reverse geocoding or the profile).
      let name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
      if (typeof body.city === 'string' && body.city.trim()) {
        const g = await geocode(body.city.trim());
        if (!g) throw new Upstream('location_not_found');
        ({ lat, lon, name } = g);
      }
      if (!isLatLon(lat, lon)) throw new Upstream('bad_request');
      try {
        return await openMeteo(lat, lon!, name);
      } catch (e) {
        const key = Deno.env.get('OPENWEATHER_API_KEY');
        if (!key) throw e;
        console.warn('open-meteo failed, using openweather', String(e));
        return await openWeather(lat, lon!, key);
      }
    });
    return json({ ...res.data, cached: res.cached, fetched_at: res.fetched_at });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'location_not_found') return fail('location_not_found', 404);
    if (msg === 'bad_request') return fail('bad_request');
    console.error('weather', msg);
    return fail('weather_unavailable', 502);
  }
});
