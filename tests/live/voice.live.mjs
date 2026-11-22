// Live voice transcription benchmark (old upload path vs direct body). Temporary qa- user, deleted afterwards.
// Run from repo root: NODE_USE_ENV_PROXY=1 PAT=<supabase access token> node tests/live/voice.live.mjs <recording.m4a>
import { readFileSync } from 'fs';
const R = 'yrlfpbbbvjfguoratasn', U = `https://${R}.supabase.co`, PAT = process.env.PAT;
const PUB = readFileSync('.env', 'utf8').match(/PUBLISHABLE_KEY=(.*)/)[1].trim();
const keys = await (await fetch(`https://api.supabase.com/v1/projects/${R}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${PAT}` } })).json();
const SECRET = (keys.find((k) => k.type === 'secret') ?? keys.find((k) => k.name === 'service_role')).api_key;
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const email = `qa-voice+${Date.now()}@example.com`, password = 'QaTest-12345'; let uid;
const audio = readFileSync(process.argv[2]);
try {
  uid = (await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) })).json()).id;
  const tok = (await (await fetch(`${U}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json()).access_token;
  const auth = { apikey: PUB, Authorization: `Bearer ${tok}` };
  for (let run = 1; run <= 2; run++) {
    await new Promise((r) => setTimeout(r, 8000));
    let t = Date.now(); const path = `${uid}/assistant/qa-${Date.now()}.m4a`;
    await fetch(`${U}/storage/v1/object/media/${path}`, { method: 'POST', headers: { ...auth, 'Content-Type': 'audio/mp4' }, body: audio });
    const up = Date.now() - t;
    const r1 = await fetch(`${U}/functions/v1/transcribe`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ audio_path: path, language: 'te' }) });
    const j1 = await r1.json(); console.log(`old (upload ${up}ms + fn) total=${Date.now() - t}ms ${r1.status} ${j1.text ?? JSON.stringify(j1)}`);
    await new Promise((r) => setTimeout(r, 8000));
    t = Date.now();
    const r2 = await fetch(`${U}/functions/v1/transcribe`, { method: 'POST', headers: { ...auth, 'Content-Type': 'audio/mp4', 'x-language': 'te' }, body: audio });
    const j2 = await r2.json(); console.log(`new (direct)      total=${Date.now() - t}ms ${r2.status} ${j2.text ?? JSON.stringify(j2)}`);
  }
  const big = Buffer.alloc(6 * 1024 * 1024);
  const r3 = await fetch(`${U}/functions/v1/transcribe`, { method: 'POST', headers: { ...auth, 'Content-Type': 'audio/mp4' }, body: big });
  console.log('6 MB body →', r3.status, JSON.stringify(await r3.json().catch(() => null)));
  const r4 = await fetch(`${U}/functions/v1/transcribe`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'audio/mp4' }, body: audio });
  console.log('no login →', r4.status);
  const left = await (await fetch(`${U}/storage/v1/object/list/media`, { method: 'POST', headers: admin, body: JSON.stringify({ prefix: `${uid}/assistant/` }) })).json();
  console.log('voice files left in storage:', left.length);
} finally { if (uid) console.log('cleanup', (await fetch(`${U}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: admin })).status); }
