// Usage: npx expo export -p web (with EXPO_PUBLIC_SUPABASE_URL=https://mock.supabase.co) then
// node tests/e2e/agriculture.mock.e2e.js <web-dir> <screenshot-dir> <leaf.jpg>
// Playwright E2E against an in-memory Supabase mock (auth, PostgREST, functions, storage).
const http = require('http'), fs = require('fs'), path = require('path'); const { chromium } = require('playwright');
const [root, out, leaf] = process.argv.slice(2);
const types = { '.js': 'text/javascript', '.html': 'text/html', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf' };
const srv = http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html'); r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); }).listen(8098);

const UID = '11111111-1111-1111-1111-111111111111';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.sig`;
const user = { id: UID, email: 'ramesh@farm.in', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
const today = new Date().toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
let n = 0; const id = () => `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`;
const db = {
  profiles: [{ id: UID, full_name: 'Ramesh Kumar', preferred_language: 'en', sectors: ['agriculture'], village: 'Kovur', district: 'Nellore', state: 'Andhra Pradesh', latitude: 14.5, longitude: 79.98, onboarding_completed: true, avatar_path: null }],
  farms: [], crops: [], crop_records: [], crop_scans: [], disease_reports: [], treatment_records: [], saved_records: [], uploaded_media: [], activity_logs: [],
};
const log = [];
const embed = (table, row) => {
  const r = { ...row };
  if (table === 'crops') r.farm = db.farms.find((f) => f.id === row.farm_id) ? { name: db.farms.find((f) => f.id === row.farm_id).name } : null;
  if (table === 'crop_records') { const c = db.crops.find((c) => c.id === row.crop_id); r.crop = c ? { id: c.id, name: c.name } : null; }
  if (table === 'crop_scans') { r.report = db.disease_reports.filter((d) => d.scan_id === row.id); const c = db.crops.find((c) => c.id === row.crop_id); r.crop = c ? { id: c.id, name: c.name } : null; }
  return r;
};
function filterRows(table, params) {
  let rows = db[table] || [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(k)) continue;
    const [op, ...rest] = v.split('.'); const val = rest.join('.');
    rows = rows.filter((r) => {
      const x = r[k];
      if (op === 'eq') return String(x) === val;
      if (op === 'gte') return x != null && x >= val;
      if (op === 'lte') return x != null && x <= val;
      if (op === 'lt') return x != null && x < val;
      if (op === 'is') return val === 'null' ? x == null : true;
      return true;
    });
  }
  return rows;
}
const weather = { location: { name: 'Kovur', lat: 14.5, lon: 79.98 }, observed_at: new Date().toISOString(),
  current: { temp: 31, feels_like: 35, humidity: 74, wind_kmh: 14, rain_1h_mm: 0, condition: 'Clouds', icon: '03d', pop_today: 40 },
  daily: [0, 1, 2, 3, 4].map((i) => ({ date: addDays(i), min: 24 + i % 2, max: 32 + (i === 2 ? 9 : 0), pop: [40, 90, 20, 10, 30][i], rain_mm: [2, 34.5, 0, 0, 1][i], condition: ['Clouds', 'Rain', 'Clear', 'Clear', 'Clouds'][i], icon: '03d', wind_kmh: 12 })),
  advisories: [{ kind: 'heavy_rain', date: addDays(1), value: 34.5 }, { kind: 'heat', date: addDays(2), value: 41 }] };

(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }); const pg = await ctx.newPage(); global.pg = pg;
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message)); pg.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await pg.route('https://mock.supabase.co/**', async (route) => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const method = req.method();
    const json = (body, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (p.startsWith('/auth/v1/token')) return json({ access_token: jwt, refresh_token: 'r', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user });
    if (p.startsWith('/auth/v1/user')) return json(user);
    if (p.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204 });
    if (p === '/functions/v1/weather') { log.push('fn:weather ' + req.postData()); return json(weather); }
    if (p === '/functions/v1/crop-scan') {
      const { scan_id } = JSON.parse(req.postData()); log.push('fn:crop-scan');
      const raw = { is_plant_image: true, condition_name: 'Rice Blast', confidence: 'high', severity: 'moderate', summary: 'Spindle-shaped grey lesions with brown margins on leaves.', symptoms: ['Diamond-shaped spots', 'Grey centres', 'Brown margins'], causes: ['Fungus Magnaporthe oryzae', 'High humidity and excess nitrogen'],
        treatments: { cultural: ['Drain the field for 2-3 days', 'Avoid extra urea now'], organic: ['Spray Pseudomonas fluorescens'], chemical: ['Tricyclazole 75 WP as per label dose'], prevention: ['Use resistant varieties next season'] }, recommend_expert: true, expert_reason: 'Spreading quickly in humid weather.' };
      const rep = { id: id(), scan_id, owner_id: UID, condition_name: raw.condition_name, confidence: 'high', severity: 'moderate', summary: raw.summary, symptoms: raw.symptoms, recommend_expert: true, raw_response: raw, created_at: new Date().toISOString() };
      db.disease_reports.push(rep); db.crop_scans.find((s) => s.id === scan_id).status = 'completed'; return json(rep);
    }
    if (p.startsWith('/storage/v1/object/media/')) { log.push('upload ' + p.split('/media/')[1]); return json({ Key: p }); }
    if (p.startsWith('/storage/v1/object/sign/')) return json({ error: 'not found' }, 400);
    const m = p.match(/^\/rest\/v1\/(\w+)$/);
    if (m) {
      const table = m[1]; const params = [...url.searchParams.entries()]; const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
      if (method === 'HEAD' || (method === 'GET' && (req.headers()['prefer'] || '').includes('count=exact') && url.searchParams.get('select') === 'id')) {
        const c = filterRows(table, params).length; return route.fulfill({ status: 200, headers: { 'content-range': `0-${Math.max(c - 1, 0)}/${c}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: method === 'HEAD' ? '' : '[]' });
      }
      if (method === 'GET') { const rows = filterRows(table, params).map((r) => embed(table, r)); return json(single ? rows[0] ?? null : rows, single && !rows[0] ? 406 : 200); }
      if (method === 'POST') {
        let body = JSON.parse(req.postData()); const arr = Array.isArray(body) ? body : [body];
        const rows = arr.map((r) => ({ id: id(), owner_id: UID, created_at: new Date().toISOString(), status: table === 'crops' ? 'growing' : table === 'crop_scans' ? 'pending' : undefined, completed_at: null, ...r }));
        db[table].push(...rows); log.push(`insert ${table} ${JSON.stringify(arr).slice(0, 120)}`);
        return json(single ? embed(table, rows[0]) : rows.map((r) => embed(table, r)), 201);
      }
      if (method === 'PATCH') { const patch = JSON.parse(req.postData()); filterRows(table, params).forEach((r) => Object.assign(r, patch)); log.push(`update ${table} ${JSON.stringify(patch).slice(0, 80)}`); return json([]); }
      if (method === 'DELETE') { const del = new Set(filterRows(table, params)); db[table] = db[table].filter((r) => !del.has(r)); log.push(`delete ${table}`); return json([]); }
    }
    log.push('UNMOCKED ' + method + ' ' + p); return json({}, 404);
  });

  const shot = async (name) => { await pg.waitForTimeout(900); await pg.screenshot({ path: `${out}/${name}.png`, fullPage: true }); };
  const base = 'http://localhost:8098';
  await pg.goto(base + '/auth/login'); await pg.waitForTimeout(1500);
  await pg.getByTestId('login-identifier').fill('ramesh@farm.in'); await pg.getByTestId('login-password').fill('secret123'); await pg.getByTestId('login-submit').click();
  await pg.waitForURL('**/home', { timeout: 10000 }); await shot('09-dashboard-empty');

  await pg.goto(base + '/agriculture/farms/new'); await pg.waitForTimeout(1200);
  await pg.getByTestId('farm-save').click(); await shot('11-addfarm-validation');
  await pg.getByTestId('farm-name').fill('Canal-side field'); await pg.getByLabel('Area (acres)').fill('4.5');
  await pg.getByRole('radio', { name: 'Black (cotton)' }).click(); await pg.getByRole('radio', { name: 'Canal' }).click();
  await pg.getByTestId('farm-save').click(); await pg.waitForURL(/farms\/0000/, { timeout: 8000 }); await shot('12-farm-details');

  await pg.goto(base + '/agriculture/crops/new'); await pg.waitForTimeout(1200);
  await pg.getByRole('radio', { name: 'Paddy' }).click(); await pg.getByLabel('Variety').first().fill('BPT 5204');
  await pg.getByRole('radio', { name: 'Kharif' }).click();
  await pg.getByPlaceholder('YYYY-MM-DD').first().fill(addDays(-40)); await pg.getByPlaceholder('YYYY-MM-DD').nth(1).fill(addDays(80));
  await shot('15-addcrop-filled'); await pg.getByTestId('crop-save').click(); await pg.waitForURL(/crops\/0000/, { timeout: 8000 }); await shot('14-crop-details');

  await pg.goto(base + '/agriculture/calendar'); await pg.waitForTimeout(1200);
  await pg.getByTestId('calendar-add').click(); await pg.waitForTimeout(500);
  await pg.getByRole('radio', { name: 'Fertilizer' }).click(); await pg.getByRole('button', { name: 'Save' }).click(); await pg.waitForTimeout(800); await shot('16-calendar');
  await pg.getByRole('checkbox', { name: /Mark done: Fertilizer/ }).click(); await pg.waitForTimeout(600);

  await pg.goto(base + '/agriculture/crops'); await shot('13-crops');
  await pg.goto(base + '/agriculture'); await shot('10-farms');
  await pg.goto(base + '/agriculture/weather'); await shot('17-weather');

  // Scanner: web image picker → file chooser.
  await pg.goto(base + '/agriculture/scan'); await pg.waitForTimeout(1200);
  await pg.getByTestId('scan-analyse').click(); await pg.waitForTimeout(300); await shot('18-scan-needphoto');
  await pg.getByRole('button', { name: 'Add photo' }).click(); await pg.waitForTimeout(400);
  const [fc] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.getByRole('button', { name: 'Gallery' }).click()]);
  await fc.setFiles(leaf); await pg.waitForTimeout(1500); await shot('18-scan-ready');
  await pg.getByTestId('scan-analyse').click(); await pg.waitForURL(/scan\/0000/, { timeout: 15000 }); await shot('19-result');
  await pg.getByTestId('view-treatment').click(); await pg.waitForURL(/treatment/); await pg.waitForTimeout(800);
  await pg.getByRole('checkbox', { name: 'Drain the field for 2-3 days' }).click(); await pg.getByRole('checkbox', { name: /Tricyclazole/ }).click();
  await pg.getByTestId('save-treatment').click(); await pg.waitForTimeout(1000); await shot('20-treatment');

  await pg.goto(base + '/home'); await shot('09-dashboard');
  console.log('TABBAR', JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('[role=tab]')].map((t) => { const r = t.getBoundingClientRect(); const l = [...t.querySelectorAll('div')].find((d) => d.textContent === 'Home' || d.textContent === 'Agri'); const lr = l?.getBoundingClientRect(); return { tab: [r.top, r.bottom], label: lr && [lr.top, lr.bottom], vh: innerHeight }; }))));
  await pg.getByRole('radio', { name: 'Telugu' }).first().click(); await shot('09-dashboard-te');
  console.log(log.join('\n')); console.log('ERRORS', JSON.stringify([...new Set(errs)].slice(0, 8)));
  await b.close(); srv.close();
})().catch(async (e) => { console.log('FAIL', e.message.split('\n').slice(0,3).join(' / ')); console.log(log.slice(-8).join('\n')); console.log('URL', global.pg.url()); await global.pg.screenshot({ path: out + '/fail.png', fullPage: true }); process.exit(1); });
