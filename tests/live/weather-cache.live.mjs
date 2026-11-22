// Live weather cache check. Temporary qa- user, deleted afterwards.
// Run from repo root: NODE_USE_ENV_PROXY=1 PAT=<supabase access token> node tests/live/weather-cache.live.mjs
import { readFileSync } from 'fs';
const R = 'yrlfpbbbvjfguoratasn', U = `https://${R}.supabase.co`, PAT = process.env.PAT;
const PUB = readFileSync('.env', 'utf8').match(/PUBLISHABLE_KEY=(.*)/)[1].trim();
const keys = await (await fetch(`https://api.supabase.com/v1/projects/${R}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${PAT}` } })).json();
const SECRET = (keys.find((k) => k.type === 'secret') ?? keys.find((k) => k.name === 'service_role')).api_key;
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const email = `qa-weather+${Date.now()}@example.com`, password = 'QaTest-12345'; let uid;
try {
  uid = (await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) })).json()).id;
  const tok = (await (await fetch(`${U}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).access_token;
  const H = { apikey: PUB, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' };
  const lat = 15.8 + Math.random() * 0.05; // fresh cell so the first call is a real miss
  for (const [label, body] of [['first call', { lat, lon: 80.03 }], ['same place', { lat, lon: 80.03 }], ['~4 km away', { lat: lat + 0.03, lon: 80.01 }], ['city search', { city: 'Ongole,IN' }], ['city again', { city: ' ongole , IN ' }]]) {
    const t = Date.now(); const r = await fetch(`${U}/functions/v1/weather`, { method: 'POST', headers: H, body: JSON.stringify(body) }); const j = await r.json();
    console.log(label.padEnd(12), r.status, `${Date.now() - t}ms`, j.cached ? 'CACHE HIT' : 'OpenWeather', j.location?.name, j.current?.temp + '°C');
  }
  const direct = await fetch(`${U}/rest/v1/weather_cache?select=cache_key&limit=1`, { headers: H });
  console.log('farmer reading cache table directly →', direct.status, (await direct.text()).slice(0, 80));
} finally { if (uid) console.log('cleanup', (await fetch(`${U}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: admin })).status); }
