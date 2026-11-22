// GET-style POST { lat, lon } | { city }  →  current conditions, 5-day daily forecast, derived advisories.
import { cors, fail, json } from '../_shared/http.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { shape, WEATHER_TTL_MS, weatherCacheKey } from '../_shared/weather.ts';

// Service-role client for the shared cache table (no user can read/write it directly).
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const cache = serviceKey ? createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } }) : null;

const OW = 'https://api.openweathermap.org';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const key = Deno.env.get('OPENWEATHER_API_KEY');
  if (!key) return fail('weather_not_configured', 503);

  let body: { lat?: number; lon?: number; city?: string };
  try { body = await req.json(); } catch { return fail('bad_request'); }

  const cacheKey = weatherCacheKey(body);
  if (cache && cacheKey) {
    const { data: hit } = await cache.from('weather_cache').select('payload, fetched_at').eq('cache_key', cacheKey).maybeSingle();
    if (hit && Date.now() - Date.parse(hit.fetched_at) < WEATHER_TTL_MS) return json({ ...hit.payload, cached: true });
  }

  let { lat, lon } = body;
  if (typeof body.city === 'string' && body.city.trim()) {
    const q = encodeURIComponent(body.city.trim().slice(0, 80));
    const g = await fetch(`${OW}/geo/1.0/direct?q=${q}&limit=1&appid=${key}`);
    const hits = g.ok ? await g.json() : [];
    if (!hits.length) return fail('location_not_found', 404);
    ({ lat, lon } = hits[0]);
  }
  if (typeof lat !== 'number' || typeof lon !== 'number' || Math.abs(lat) > 90 || Math.abs(lon) > 180) return fail('bad_request');

  const qs = `lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
  const [c, f] = await Promise.all([fetch(`${OW}/data/2.5/weather?${qs}`), fetch(`${OW}/data/2.5/forecast?${qs}`)]);
  if (c.status === 401 || f.status === 401) return fail('weather_key_invalid', 502);
  if (!c.ok || !f.ok) return fail('weather_unavailable', 502);
  const [current, forecast] = await Promise.all([c.json(), f.json()]);
  const result = shape(current, forecast.list);
  // Best effort: a cache write failure must not fail the farmer's request.
  if (cache && cacheKey) await cache.from('weather_cache').upsert({ cache_key: cacheKey, payload: result, fetched_at: new Date().toISOString() }).then(() => {}, () => {});
  return json(result);
});
