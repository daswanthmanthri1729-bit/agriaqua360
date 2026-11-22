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
  ponds: [], water_quality_records: [], fish_records: [], fish_health_reports: [],
  livestock: [], animal_health_records: [], vaccination_records: [],
  ai_conversations: [], ai_messages: [], notifications: [],
};
const log = [];
const embed = (table, row) => {
  const r = { ...row };
  if (table === 'crops') r.farm = db.farms.find((f) => f.id === row.farm_id) ? { name: db.farms.find((f) => f.id === row.farm_id).name } : null;
  if (table === 'crop_records') { const c = db.crops.find((c) => c.id === row.crop_id); r.crop = c ? { id: c.id, name: c.name } : null; }
  if (['animal_health_records', 'vaccination_records'].includes(table)) { const a = db.livestock.find((x) => x.id === row.animal_id); r.animal = a ? { id: a.id, name: a.name, tag_id: a.tag_id, species: a.species } : null; }
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
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }); const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, permissions: ['microphone'] }); const pg = await ctx.newPage(); global.pg = pg;
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
    if (p === '/functions/v1/fish-scan') {
      const b = JSON.parse(req.postData()); log.push('fn:fish-scan ' + JSON.stringify({ pond_id: b.pond_id, n: b.image_paths.length, language: b.language }));
      const raw = { is_fish_image: true, species_identified: 'Vannamei', condition_name: 'Low-oxygen stress', confidence: 'medium', severity: 'moderate', summary: 'Shrimp look weak; matches the low oxygen you recorded.',
        signs: ['Shrimp at the surface', 'Pale body'], possible_causes: ['Dissolved oxygen 3.2 mg/L', 'High ammonia'], immediate_actions: ['Run all aerators now', 'Stop feeding today'],
        water_management: ['Exchange 10-15% water'], prevention: ['Test oxygen every early morning'], recommend_expert: true, expert_reason: 'Ammonia is high.' };
      const rep = { id: id(), owner_id: UID, pond_id: b.pond_id, image_paths: b.image_paths, observations: b.observations, condition_name: raw.condition_name, confidence: 'medium', severity: 'moderate', summary: raw.summary, recommend_expert: true, raw_response: raw, created_at: new Date().toISOString() };
      db.fish_health_reports.push(rep); return json(rep);
    }
    if (p === '/functions/v1/transcribe') { log.push(`fn:transcribe ${req.headers()['content-type']} lang=${req.headers()['x-language']} bytes=${req.postDataBuffer()?.length}`); return json({ text: 'My paddy leaves are turning yellow. What should I do?', language: 'en', unclear: false }); }
    if (p === '/functions/v1/ai-assistant') {
      const b = JSON.parse(req.postData()); log.push('fn:ai-assistant ' + JSON.stringify({ mode: b.input_mode, imgs: b.image_paths.length, conv: !!b.conversation_id, lang: b.language }));
      let cid = b.conversation_id;
      if (!cid) { cid = id(); db.ai_conversations.push({ id: cid, owner_id: UID, title: (b.message || 'Photo question').slice(0, 60), topic: 'crop', language: b.language, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }); }
      db.ai_messages.push({ id: id(), conversation_id: cid, role: 'user', content: b.message || '(photo)', input_mode: b.input_mode, image_paths: b.image_paths, created_at: new Date().toISOString() });
      const msg = { id: id(), conversation_id: cid, role: 'assistant', content: 'Yellowing in paddy at 40 days is often nitrogen deficiency. Apply 25 kg urea per acre in two splits and keep 2-3 cm water. Get a soil test to confirm.', input_mode: 'text', image_paths: [], created_at: new Date(Date.now() + 1).toISOString() };
      db.ai_messages.push(msg);
      const result = { conversation_id: cid, message: msg, follow_ups: ['Should I add zinc?', 'When to apply potash?'], recommend_expert: b.input_mode === 'image' };
      if (b.stream) { // Server-Sent Events, as the real function sends them
        log.push('fn:ai-assistant stream');
        const ev = (e, d) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
        return route.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: ev('delta', { text: 'Yellowing in paddy' }) + ev('delta', { text: msg.content }) + ev('done', result) });
      }
      return json(result);
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
        const rows = arr.map((r) => ({ id: id(), owner_id: UID, created_at: new Date().toISOString(), status: table === 'crops' ? 'growing' : table === 'crop_scans' ? 'pending' : undefined, completed_at: null, recorded_at: table === 'water_quality_records' ? new Date().toISOString() : undefined, ...r }));
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

  // ---- Batch 3: aquaculture ----
  await pg.goto(base + '/aquaculture'); await shot('21-aqua-empty');
  await pg.goto(base + '/aquaculture/ponds?add=1'); await pg.waitForTimeout(1200);
  await pg.getByTestId('pond-save').click(); await pg.waitForTimeout(300); await shot('22-pond-validation');
  await pg.getByTestId('pond-name').fill('Pond 1 (east)'); await pg.getByRole('radio', { name: 'Vannamei shrimp' }).click();
  await pg.getByPlaceholder('YYYY-MM-DD').first().fill(addDays(-40)); await pg.getByLabel('Seed stocked (number)').fill('150000');
  await pg.getByTestId('pond-save').click(); await pg.waitForURL(/ponds\/0000/, { timeout: 8000 }); await shot('23-pond-details-empty');
  await pg.getByRole('button', { name: 'Record Water' }).click(); await pg.waitForURL(/water-quality/); await pg.waitForTimeout(1200);
  await pg.getByTestId('wq-save').click(); await pg.waitForTimeout(300);
  await pg.getByTestId('wq-ph').fill('7.8'); await pg.getByTestId('wq-dissolved_oxygen_mgl').fill('3.2'); await pg.getByTestId('wq-ammonia_mgl').fill('0.9');
  await shot('24-reading-sheet'); await pg.getByTestId('wq-save').click(); await pg.waitForTimeout(1000); await shot('24-water-quality');
  await pg.goBack(); await pg.waitForTimeout(1000);
  await pg.getByRole('button', { name: 'Add Record' }).click(); await pg.waitForTimeout(500);
  await pg.getByTestId('fr-qty').fill('25'); await pg.getByTestId('fr-save').click(); await pg.waitForTimeout(800); await shot('23-pond-details');
  await pg.goto(base + '/aquaculture'); await shot('21-aqua-dashboard');
  await pg.goto(base + '/aquaculture/fish-scan?pondId=' + db.ponds[0].id); await pg.waitForTimeout(1200);
  await pg.getByRole('button', { name: 'Add photo' }).click(); await pg.waitForTimeout(400);
  const [fc2] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.getByRole('button', { name: 'Gallery' }).click()]);
  await fc2.setFiles(leaf); await pg.waitForTimeout(1200);
  await pg.getByLabel('What did you notice?').fill('Shrimp at the surface in the morning');
  await pg.getByTestId('fish-analyse').click(); await pg.getByTestId('fish-new').waitFor({ timeout: 10000 }); await shot('25-fish-result');

  // ---- Batch 4: livestock ----
  await pg.goto(base + '/livestock'); await shot('26-livestock-empty');
  await pg.goto(base + '/livestock/animals/new'); await pg.waitForTimeout(1200);
  await pg.getByTestId('animal-save').click(); await pg.waitForTimeout(300); await shot('29-animal-validation');
  await pg.getByRole('radio', { name: /Buffalo/ }).click(); await pg.getByTestId('animal-tag').fill('AP-1024'); await pg.getByTestId('animal-name').fill('Lakshmi');
  await pg.getByRole('radio', { name: 'Murrah' }).click(); await pg.getByRole('radio', { name: 'Female' }).click();
  await pg.getByPlaceholder('YYYY-MM-DD').first().fill('2023-06-10'); await pg.getByRole('radio', { name: 'Sick' }).click();
  await shot('29-animal-filled'); await pg.getByTestId('animal-save').click(); await pg.waitForURL(/animals\/0000/, { timeout: 8000 }); await shot('28-animal-details-empty');
  await pg.getByRole('button', { name: 'Add Vaccination' }).click(); await pg.waitForURL(/records/); await pg.waitForTimeout(1200);
  await pg.getByRole('radio', { name: 'HS' }).click(); await pg.getByPlaceholder('YYYY-MM-DD').first().fill(addDays(3));
  await pg.getByTestId('vacc-save').click(); await pg.waitForTimeout(800);
  await pg.getByRole('radio', { name: 'Health' }).click(); await pg.getByTestId('records-add').click(); await pg.waitForTimeout(400);
  await pg.getByTestId('health-save').click(); await pg.waitForTimeout(300);
  await pg.getByTestId('health-desc').fill('Fever and not eating. Vet gave injection.'); await pg.getByPlaceholder('YYYY-MM-DD').nth(1).fill(addDays(2));
  await shot('30-health-form'); await pg.getByTestId('health-save').click(); await pg.waitForTimeout(800); await shot('30-records');
  await pg.goto(base + '/livestock/animals/' + db.livestock[0].id); await shot('28-animal-details');
  await pg.goto(base + '/livestock'); await shot('26-livestock-dashboard');
  await pg.getByRole('button', { name: 'Mark given' }).first().click(); await pg.waitForTimeout(800);
  await pg.goto(base + '/livestock/animals'); await shot('27-animals');

  // ---- Batch 5: AI, voice, records, settings ----
  db.notifications.push({ id: id(), owner_id: UID, category: 'vaccination', title: 'Vaccination due today', body: 'Lakshmi #AP-1024: HS', route: '/livestock/animals/' + db.livestock[0].id, priority: 'normal', scheduled_for: new Date().toISOString(), read_at: null, data: {}, created_at: new Date().toISOString() });
  await pg.goto(base + '/home'); await pg.waitForTimeout(1500); await pg.getByTestId('bell').click(); await pg.waitForURL(/notifications$/); await shot('35-notifications');
  await pg.getByRole('button', { name: /Vaccination due today/ }).first().click(); await pg.waitForURL(/notifications\/0000/); await shot('36-alert-details');
  await pg.getByTestId('alert-open').click(); await pg.waitForURL(/livestock\/animals\/0000/, { timeout: 8000 });

  await pg.goto(base + '/assistant'); await shot('31-assistant-empty');
  await pg.getByTestId('chat-input').fill('My paddy leaves are yellow'); await pg.getByTestId('chat-send').click();
  await pg.getByText('Yellowing in paddy').first().waitFor({ timeout: 8000 }); await pg.waitForTimeout(600);
  await pg.getByRole('button', { name: 'Save' }).first().click(); await pg.waitForTimeout(500); await shot('31-assistant-chat');
  await pg.getByRole('radio', { name: 'Should I add zinc?' }).click(); await pg.waitForTimeout(1200);
  await pg.goto(base + '/assistant/history'); await shot('34-history');
  await pg.getByRole('button', { name: /My paddy leaves/ }).first().click(); await pg.waitForURL(/assistant/); await pg.waitForTimeout(1200);

  await pg.goto(base + '/assistant/image'); await pg.waitForTimeout(1200);
  await pg.getByTestId('image-send').click(); await pg.waitForTimeout(300);
  await pg.getByRole('button', { name: 'Add photo' }).click(); await pg.waitForTimeout(400);
  const [fc3] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 5000 }), pg.getByRole('button', { name: 'Gallery' }).click()]);
  await fc3.setFiles(leaf); await pg.waitForTimeout(1200); await pg.getByRole('radio', { name: 'What disease is this?' }).click();
  await shot('33-image-ask'); await pg.getByTestId('image-send').click(); await pg.getByText('Continue in chat').waitFor({ timeout: 10000 }); await shot('33-image-answer');

  await pg.goto(base + '/assistant/voice'); await pg.waitForTimeout(1200); await shot('32-voice-idle');
  await pg.getByTestId('voice-mic').click(); await pg.waitForTimeout(2500); await shot('32-voice-recording');
  await pg.getByTestId('voice-mic').click(); await pg.getByTestId('voice-text').waitFor({ timeout: 10000 }); await shot('32-voice-review');
  await pg.getByTestId('voice-submit').click(); await pg.getByText('Continue in chat').waitFor({ timeout: 10000 }); await shot('32-voice-answer');

  await pg.goto(base + '/records/saved'); await shot('37-saved');
  await pg.goto(base + '/reports'); await shot('38-reports');
  await pg.goto(base + '/profile'); await pg.waitForTimeout(1200); await pg.getByTestId('profile-edit').click();
  await pg.getByLabel('Full name').fill('Ramesh Kumar Reddy'); await pg.getByTestId('profile-save').click(); await pg.waitForTimeout(800); await shot('39-profile');
  await pg.getByRole('radio', { name: 'Telugu' }).first().click(); await pg.waitForTimeout(600); await shot('39-profile-te');
  await pg.goto(base + '/help'); await pg.getByRole('button', { name: /ఎలా తనిఖీ/ }).click(); await shot('40-help-te');
  await pg.getByRole('radio', { name: 'English' }).first().click().catch(() => {});
  await pg.goto(base + '/profile'); await pg.waitForTimeout(800); await pg.getByRole('radio', { name: 'English' }).first().click();

  await pg.goto(base + '/home'); await shot('09-dashboard');
  console.log('TABBAR', JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('[role=tab]')].map((t) => { const r = t.getBoundingClientRect(); const l = [...t.querySelectorAll('div')].find((d) => d.textContent === 'Home' || d.textContent === 'Agri'); const lr = l?.getBoundingClientRect(); return { tab: [r.top, r.bottom], label: lr && [lr.top, lr.bottom], vh: innerHeight }; }))));
  await pg.getByRole('radio', { name: 'Telugu' }).first().click(); await shot('09-dashboard-te');
  console.log(log.join('\n')); console.log('ERRORS', JSON.stringify([...new Set(errs)].slice(0, 8)));
  await b.close(); srv.close();
})().catch(async (e) => { console.log('FAIL', e.message.split('\n').slice(0,3).join(' / ')); console.log(log.slice(-8).join('\n')); console.log('URL', global.pg.url()); await global.pg.screenshot({ path: out + '/fail.png', fullPage: true }); process.exit(1); });
