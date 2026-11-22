// Live test against the real Supabase project. Creates a temporary qa- user and deletes it afterwards.
// Run from repo root: NODE_USE_ENV_PROXY=1 PAT=<supabase access token> node tests/live/<file> <photo.jpg>
// The token is read from the environment only — never commit it.
import { readFileSync } from 'fs';
const R = 'yrlfpbbbvjfguoratasn', U = `https://${R}.supabase.co`, PAT = process.env.PAT;
const PUB = readFileSync('.env', 'utf8').match(/PUBLISHABLE_KEY=(.*)/)[1].trim();
const keys = await (await fetch(`https://api.supabase.com/v1/projects/${R}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${PAT}` } })).json();
const SECRET = (keys.find((k) => k.type === 'secret') ?? keys.find((k) => k.name === 'service_role')).api_key;
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const email = `qa-test+${Date.now()}@example.com`, password = 'QaTest-' + Math.random().toString(36).slice(2, 10);
const log = (k, v) => console.log(k.padEnd(22), typeof v === 'string' ? v : JSON.stringify(v).slice(0, 400));
let uid, paths = [];
try {
  const cu = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: 'QA Test (delete me)', preferred_language: 'te', sectors: ['agriculture', 'aquaculture'], phone: '+919876543210' } }) })).json();
  uid = cu.id; log('create test user', uid ? 'ok' : cu);
  const tok = await (await fetch(`${U}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
  log('password login', tok.access_token ? 'ok' : tok);
  const H = { apikey: PUB, Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };
  const rest = async (p, init = {}) => { const r = await fetch(`${U}/rest/v1/${p}`, { headers: { ...H, Prefer: 'return=representation', ...(init.headers || {}) }, ...init }); return [r.status, await r.json().catch(() => null)]; };
  const fn = async (name, body) => { const t = Date.now(); const r = await fetch(`${U}/functions/v1/${name}`, { method: 'POST', headers: H, body: JSON.stringify(body) }); return [r.status, Date.now() - t, await r.json().catch(() => null)]; };

  const [, prof] = await rest(`profiles?id=eq.${uid}&select=full_name,preferred_language,sectors,phone`); log('trigger profile', prof);
  const [, all] = await rest('profiles?select=id'); log('RLS profiles visible', all.length);
  const [fst, farm] = await rest('farms', { method: 'POST', body: JSON.stringify({ name: 'QA farm', area_acres: 2 }) }); log('farm insert', [fst, farm]);
  const [, crop] = await rest('crops', { method: 'POST', body: JSON.stringify({ farm_id: farm[0].id, name: 'Paddy', variety: 'BPT 5204', sowing_date: '2026-10-13' }) });
  log('farm + crop insert', crop[0]?.id ? 'ok' : crop);

  const [ws, wt, w] = await fn('weather', { lat: 16.71, lon: 81.1 });
  log('weather', `${ws} ${wt}ms ` + (w?.current ? `${w.location.name} ${w.current.temp}°C ${w.current.condition}, ${w.daily.length} days, advisories ${w.advisories.length}` : JSON.stringify(w)));

  const [as, at, a] = await fn('ai-assistant', { message: 'నా వరి ఆకులు పసుపు రంగులోకి మారుతున్నాయి. ఏం చేయాలి?', input_mode: 'text', language: 'te' });
  log('ai-assistant (te)', `${as} ${at}ms ` + (a?.message ? a.message.content.slice(0, 160) : JSON.stringify(a)));

  const img = readFileSync(process.argv[2]); const path = `${uid}/scans/qa-${Date.now()}.jpg`; paths.push(path);
  const up = await fetch(`${U}/storage/v1/object/media/${path}`, { method: 'POST', headers: { apikey: PUB, Authorization: H.Authorization, 'Content-Type': 'image/jpeg' }, body: img });
  log('storage upload', up.status);
  const other = await fetch(`${U}/storage/v1/object/media/00000000-0000-0000-0000-000000000000/scans/x.jpg`, { method: 'POST', headers: { apikey: PUB, Authorization: H.Authorization, 'Content-Type': 'image/jpeg' }, body: img });
  log('upload to other user', `${other.status} (should be 4xx)`);
  const [, scan] = await rest('crop_scans', { method: 'POST', body: JSON.stringify({ image_paths: [path], crop_id: crop[0].id, scan_type: 'disease', language: 'en' }) });
  const [cs, ct, c] = await fn('crop-scan', { scan_id: scan[0].id });
  log('crop-scan', `${cs} ${ct}ms ` + (c?.condition_name ? `${c.condition_name} | ${c.confidence} | ${c.severity} | expert=${c.recommend_expert}` : JSON.stringify(c)));

  const [fs, ft, f] = await fn('fish-scan', { image_paths: [path], observations: 'test', language: 'hi' });
  log('fish-scan (leaf photo)', `${fs} ${ft}ms ` + (f?.raw_response ? `is_fish_image=${f.raw_response.is_fish_image} | ${f.condition_name}` : JSON.stringify(f)));
  const [ts, , tr] = await fn('transcribe', { audio_path: `${uid}/assistant/missing.m4a`, language: 'te' });
  log('transcribe (missing)', `${ts} ${JSON.stringify(tr)}`);
} finally {
  if (paths.length) await fetch(`${U}/storage/v1/object/media`, { method: 'DELETE', headers: admin, body: JSON.stringify({ prefixes: paths }) }).then((r) => log('cleanup photos', r.status));
  if (uid) await fetch(`${U}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: admin }).then((r) => log('cleanup test user', r.status));
}
