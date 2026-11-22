// Live test against the real Supabase project. Creates a temporary qa- user and deletes it afterwards.
// Run from repo root: NODE_USE_ENV_PROXY=1 PAT=<supabase access token> node tests/live/<file> <photo.jpg>
// The token is read from the environment only — never commit it.
import { readFileSync } from 'fs';
const R = 'yrlfpbbbvjfguoratasn', U = `https://${R}.supabase.co`, PAT = process.env.PAT;
const PUB = readFileSync('.env', 'utf8').match(/PUBLISHABLE_KEY=(.*)/)[1].trim();
const keys = await (await fetch(`https://api.supabase.com/v1/projects/${R}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${PAT}` } })).json();
const SECRET = (keys.find((k) => k.type === 'secret') ?? keys.find((k) => k.name === 'service_role')).api_key;
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const pub = { apikey: PUB, 'Content-Type': 'application/json' };
const email = `qa-reset+${Date.now()}@example.com`, oldPw = 'OldPass-123', newPw = 'NewPass-456';
const log = (k, v) => console.log(k.padEnd(34), v);
const post = async (p, h, b) => { const r = await fetch(`${U}${p}`, { method: 'POST', headers: h, body: JSON.stringify(b) }); return [r.status, await r.json().catch(() => ({}))]; };
const login = async (pw) => (await post('/auth/v1/token?grant_type=password', pub, { email, password: pw }))[0];
let uid;
try {
  const [, u] = await post('/auth/v1/admin/users', admin, { email, password: oldPw, email_confirm: true, user_metadata: { full_name: 'QA reset (delete me)', preferred_language: 'te' } }); uid = u.id;
  log('test user created (te)', !!uid);
  const [gs, g] = await post('/auth/v1/admin/generate_link', admin, { type: 'recovery', email });
  const otp = g.email_otp ?? g.properties?.email_otp;
  log('recovery code generated', `${gs} length=${otp?.length} digits=${/^\d+$/.test(otp)}`);
  const wrong = otp === '000000' ? '111111' : '000000';
  const [ws, w] = await post('/auth/v1/verify', pub, { type: 'recovery', email, token: wrong }); log('wrong code', `${ws} ${w.error_code ?? w.code ?? ''}`);
  const [vs, v] = await post('/auth/v1/verify', pub, { type: 'recovery', email, token: otp }); log('correct code', `${vs} session=${!!v.access_token}`);
  const up = await fetch(`${U}/auth/v1/user`, { method: 'PUT', headers: { ...pub, Authorization: `Bearer ${v.access_token}` }, body: JSON.stringify({ password: newPw }) });
  log('set new password', up.status);
  const same = await fetch(`${U}/auth/v1/user`, { method: 'PUT', headers: { ...pub, Authorization: `Bearer ${v.access_token}` }, body: JSON.stringify({ password: newPw }) });
  log('same password again', `${same.status} ${(await same.json().catch(() => ({}))).error_code ?? ''}`);
  log('login with NEW password', await login(newPw));
  log('login with OLD password', await login(oldPw));
  const [rs, r] = await post('/auth/v1/verify', pub, { type: 'recovery', email, token: otp }); log('reuse same code', `${rs} ${r.error_code ?? ''}`);
  const [es, e] = await post('/auth/v1/recover', pub, { email }); log('real reset email via Resend', `${es} ${JSON.stringify(e).slice(0, 220)}`);
  const [es2, e2] = await post('/auth/v1/recover', pub, { email }); log('immediate resend (60 s gap)', `${es2} ${e2.error_code ?? JSON.stringify(e2).slice(0, 120)}`);
} finally {
  if (uid) { const r = await fetch(`${U}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: admin }); log('cleanup test user', r.status); }
}
