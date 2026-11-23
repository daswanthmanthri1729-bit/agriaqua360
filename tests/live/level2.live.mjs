// Level 2 live checks against the real Supabase project. Creates a temporary qa- user and deletes it afterwards.
// Run from repo root: NODE_USE_ENV_PROXY=1 PAT=<supabase access token> node tests/live/level2.live.mjs [only=weather,environment,...]
// The token is read from the environment only — never commit it.
import { readFileSync } from 'fs';
const R = 'yrlfpbbbvjfguoratasn', U = `https://${R}.supabase.co`, PAT = process.env.PAT;
const only = (process.argv.find((a) => a.startsWith('only=')) ?? '').slice(5).split(',').filter(Boolean);
const want = (k) => !only.length || only.includes(k);
const PUB = readFileSync('.env', 'utf8').match(/PUBLISHABLE_KEY=(.*)/)[1].trim();
const keys = await (await fetch(`https://api.supabase.com/v1/projects/${R}/api-keys?reveal=true`, { headers: { Authorization: `Bearer ${PAT}` } })).json();
const SECRET = (keys.find((k) => k.type === 'secret') ?? keys.find((k) => k.name === 'service_role')).api_key;
const admin = { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' };
const email = `qa-test+${Date.now()}@example.com`, password = 'QaTest-' + Math.random().toString(36).slice(2, 10);
let failures = 0;
const log = (k, v) => console.log(k.padEnd(26), typeof v === 'string' ? v : JSON.stringify(v).slice(0, 500));
const check = (k, cond, v) => { if (!cond) failures++; log(`${cond ? 'PASS' : 'FAIL'} ${k}`, v); };
let uid;
try {
  const cu = await (await fetch(`${U}/auth/v1/admin/users`, { method: 'POST', headers: admin, body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: 'QA Test (delete me)', preferred_language: 'en', sectors: ['agriculture', 'aquaculture', 'livestock'] } }) })).json();
  uid = cu.id;
  const tok = await (await fetch(`${U}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })).json();
  const H = { apikey: PUB, Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };
  const rest = async (p, init = {}) => { const r = await fetch(`${U}/rest/v1/${p}`, { headers: { ...H, Prefer: 'return=representation', ...(init.headers || {}) }, ...init }); return [r.status, await r.json().catch(() => null)]; };
  const fn = async (name, body, headers = { ...H, ...(process.env.REGION ? { 'x-region': process.env.REGION } : {}) }) => { const t = Date.now(); const r = await fetch(`${U}/functions/v1/${name}`, { method: 'POST', headers, body: JSON.stringify(body) }); return [r.status, Date.now() - t, await r.json().catch(() => null)]; };
  globalThis.ctx = { rest, fn, H, uid, PUB };

  if (want('weather')) {
    const [s, t, w] = await fn('weather', { lat: 16.52, lon: 80.21 });
    check('weather open-meteo', s === 200 && w.source === 'open-meteo' && w.daily.length === 7 && w.hourly.length >= 24, `${s} ${t}ms ${w.source} ${w.location?.name} ${w.current?.temp}°C ${w.current?.condition} et0=${w.daily?.[0]?.et0_mm} soil=${JSON.stringify(w.soil_moisture_estimate)}`);
    const [s2, t2, w2] = await fn('weather', { lat: 16.31, lon: 80.44 });
    check('weather cache hit', s2 === 200 && w2.cached === true, `${s2} ${t2}ms cached=${w2.cached}`);
    const [s3, , w3] = await fn('weather', { city: 'Tenali,IN' });
    check('weather city search', s3 === 200 && Math.abs(w3.location.lat - 16.3) < 0.3, `${s3} ${w3.location?.name} ${w3.location?.lat}`);
  }
  if (want('environment')) {
    const [s, t, h] = await fn('environment', { kind: 'history', lat: 16.31, lon: 80.44, days: 30 });
    check('NASA POWER history', s === 200 && h.days?.length >= 20, `${s} ${t}ms days=${h.days?.length} until=${h.data_until} ${JSON.stringify(h.summary)} last_year=${JSON.stringify(h.last_year_summary)}`);
    const [s2, t2, so] = await fn('environment', { kind: 'soil', lat: 16.52, lon: 80.21 });
    check('SoilGrids', s2 === 200 && so.layers?.length >= 6, `${s2} ${t2}ms texture=${so.texture} ` + JSON.stringify(so.layers?.map((l) => [l.property, l.depths[0].value, l.unit])) + (so.error ?? ''));
    const [s3] = await fn('environment', { kind: 'history', lat: 16.31, lon: 80.44 }, { ...H, Authorization: '' });
    check('environment needs sign-in', s3 === 401, s3);
  }
  if (want('iot')) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const [, pond] = await rest('ponds', { method: 'POST', body: JSON.stringify({ name: 'QA pond', species: 'vannamei' }) });
    const [, animal] = await rest('livestock', { method: 'POST', body: JSON.stringify({ species: 'cow', tag_id: 'QA-1', name: 'Ganga' }) });
    // Simulated pond node: history + a low-oxygen scenario → alert, notification, water-quality snapshot, all labelled simulated.
    const [rs, , reg] = await fn('devices', { action: 'register', name: 'Sim pond node', kind: 'pond_node', simulated: true, pond_id: pond[0].id });
    check('register simulated device', rs === 200 && reg.device?.is_simulated && reg.secret === null, `${rs} ${reg.device?.id} secret=${reg.secret}`);
    const [ss, st, sim] = await fn('devices', { action: 'simulate', device_id: reg.device.id, scenario: 'low_oxygen', backfill_hours: 24 });
    check('simulate + backfill', ss === 200 && sim.accepted === 8 && sim.source === 'simulated', `${ss} ${st}ms accepted=${sim.accepted} ${JSON.stringify(sim.rejected)}`);
    await sleep(1500);
    const [, n] = await rest(`sensor_readings?device_id=eq.${reg.device.id}&select=id`);
    const [, srcs] = await rest(`sensor_readings?device_id=eq.${reg.device.id}&source=neq.simulated&select=id`);
    check('simulated readings labelled', n.length > 700 && srcs.length === 0, `rows=${n.length} non-simulated=${srcs.length}`);
    const [, al] = await rest(`sensor_alerts?device_id=eq.${reg.device.id}&select=kind,sensor_type,value,source,status`);
    check('low-DO alert (simulated)', al.some((a) => a.sensor_type === 'water_do' && a.kind === 'low' && a.source === 'simulated'), al);
    const [, notes] = await rest('notifications?category=eq.sensor&select=title');
    check('notification written', notes.some((x) => /simulated/.test(x.title)), notes);
    const [, wq] = await rest(`water_quality_records?pond_id=eq.${pond[0].id}&select=source,dissolved_oxygen_mgl,water_level_cm`);
    check('pond WQ snapshot', wq.length === 1 && wq[0].source === 'simulated', wq);
    const [, series] = await rest('rpc/sensor_series', { method: 'POST', body: JSON.stringify({ p_sensor_type: 'water_do', p_from: new Date(Date.now() - 86400000).toISOString(), p_to: new Date().toISOString(), p_device: reg.device.id }) });
    check('chart buckets', Array.isArray(series) && series.length >= 90 && series.length <= 125, `${series.length} points, first=${JSON.stringify(series[0])}`);

    // Real device with a key.
    const [, , real] = await fn('devices', { action: 'register', name: 'Field node 1', kind: 'field_node', sensors: ['soil_moisture', 'soil_ph', 'battery'] });
    check('register real device', !!real.secret?.startsWith('aq_'), `secret ${real.secret?.slice(0, 7)}… ${JSON.stringify(real).slice(0, 200)}`);
    const dev = (id, key) => ({ 'Content-Type': 'application/json', 'x-device-id': id, 'x-device-key': key });
    const ing = async (body, h) => { const r = await fetch(`${U}/functions/v1/ingest`, { method: 'POST', headers: h, body: JSON.stringify(body) }); return [r.status, await r.json().catch(() => null)]; };
    const [bad] = await ing({ readings: [{ s: 'soil_moisture', v: 30 }] }, dev(real.device.id, 'aq_wrongwrongwrongwrongwrong'));
    check('wrong key refused', bad === 401, bad);
    const [g1, r1] = await ing({ readings: [{ s: 'soil_moisture', v: 12 }, { s: 'soil_ph', v: 17 }, { s: 'water_do', v: 5 }], battery: 77, rssi: -70, fw: '1.0.0' }, dev(real.device.id, real.secret));
    check('ingest validates', g1 === 200 && r1.accepted === 1 && r1.rejected.length === 2, `${g1} accepted=${r1?.accepted} rejected=${JSON.stringify(r1?.rejected)}`);
    const [g2] = await ing({ readings: [{ s: 'soil_moisture', v: 13 }] }, dev(real.device.id, real.secret));
    check('rate limit', g2 === 429, g2);
    await sleep(1500);
    const [, ral] = await rest(`sensor_alerts?device_id=eq.${real.device.id}&select=kind,sensor_type,source`);
    check('dry-soil + impossible-pH alerts', ral.some((a) => a.kind === 'low' && a.sensor_type === 'soil_moisture' && a.source === 'sensor') && ral.some((a) => a.kind === 'rejected'), ral);
    const [, dv] = await rest(`sensor_devices?id=eq.${real.device.id}&select=battery_pct,firmware,last_seen_at`);
    check('device status', Number(dv[0].battery_pct) === 77 && dv[0].firmware === '1.0.0' && !!dv[0].last_seen_at, dv[0]);
    const [fake] = await rest('sensor_readings', { method: 'POST', body: JSON.stringify({ sensor_type: 'soil_moisture', value: 40, source: 'sensor', recorded_at: new Date().toISOString() }) });
    check('app cannot fake sensor data', fake >= 400, fake);

    // Equipment: controller with a pump; command → delivered → acknowledged.
    const [, , ctl] = await fn('devices', { action: 'register', name: 'Pump box', kind: 'controller', actuators: [{ channel: 'pump1', type: 'pump', label: 'Borewell pump', max_run_s: 1800 }] });
    const [cs, cmd] = await rest('actuator_commands', { method: 'POST', body: JSON.stringify({ device_id: ctl.device.id, channel: 'pump1', action: 'on', duration_s: 600 }) });
    const [over] = await rest('actuator_commands', { method: 'POST', body: JSON.stringify({ device_id: ctl.device.id, channel: 'pump1', action: 'on', duration_s: 7200 }) });
    check('command queued, over-limit refused', cs === 201 && over >= 400, `${cs} / ${over}`);
    const [, poll] = await ing({ actuators: { pump1: { state: 'off', manual: false } } }, dev(ctl.device.id, ctl.secret));
    check('device receives command', poll.commands?.[0]?.id === cmd[0].id && poll.commands[0].duration_s === 600, poll.commands);
    await sleep(5200);
    await ing({ acks: [{ id: cmd[0].id, ok: true, msg: 'pump on 600s' }], actuators: { pump1: { state: 'on', manual: false } } }, dev(ctl.device.id, ctl.secret));
    const [, done] = await rest(`actuator_commands?id=eq.${cmd[0].id}&select=status,result`);
    const [, ch] = await rest(`device_channels?device_id=eq.${ctl.device.id}&select=state`);
    check('ack + state', done[0].status === 'done' && ch[0].state === 'on', [done[0], ch[0]]);
    const [sim2] = await fn('devices', { action: 'register', name: 'x', kind: 'controller', simulated: true, actuators: [{ channel: 'p', type: 'pump', max_run_s: 60 }] });
    check('simulated equipment refused', sim2 === 400, sim2);

    // Automation rule on the real field node: soil moisture < 20 → pump on 300 s.
    const [rr] = await rest('automation_rules', { method: 'POST', body: JSON.stringify({ name: 'Water when dry', enabled: true, sensor_device_id: real.device.id, sensor_type: 'soil_moisture', operator: '<', threshold: 20, target_device_id: ctl.device.id, target_channel: 'pump1', action: 'on', duration_s: 300 }) });
    await sleep(5200);
    await ing({ readings: [{ s: 'soil_moisture', v: 11 }] }, dev(real.device.id, real.secret));
    const [, rc] = await rest(`actuator_commands?requested_by=eq.rule&select=channel,action,duration_s,status`);
    check('automation rule fires', rr === 201 && rc.length === 1 && rc[0].duration_s === 300, [rr, rc]);

    // Collar + geofence.
    const [, , collar] = await fn('devices', { action: 'register', name: 'Ganga collar', kind: 'collar', simulated: true, animal_id: animal[0].id });
    await rest('geofences', { method: 'POST', body: JSON.stringify({ name: 'Home paddock', polygon: [[80.19, 16.49], [80.21, 16.49], [80.21, 16.51], [80.19, 16.51]] }) });
    await fn('devices', { action: 'simulate', device_id: collar.device.id, scenario: 'fever' });
    await sleep(1500);
    const [, cal] = await rest(`sensor_alerts?animal_id=eq.${animal[0].id}&select=kind,source`);
    const [, locs] = await rest(`animal_locations?animal_id=eq.${animal[0].id}&select=latitude,source`);
    check('collar location + geofence alert', locs.length === 1 && cal.some((a) => a.kind === 'geofence'), [locs, cal]);
  }
  if (want('market')) {
    const [s, t, m] = await fn('market', { action: 'prices', commodity: 'Maize', state: 'Andhra Pradesh' });
    check('market responds', s === 200 && typeof m.configured === 'boolean', `${s} ${t}ms configured=${m.configured} markets=${m.markets?.length} ${m.warning ?? ''}`);
    const [s2, , c] = await fn('market', { action: 'commodities', q: 'pad' });
    check('commodity search', s2 === 200 && c.commodities.some((x) => x.startsWith('Paddy')), c.commodities);
  }
  if (want('insights')) {
    const [, pond] = await rest('ponds', { method: 'POST', body: JSON.stringify({ name: 'Insight pond', species: 'rohu' }) });
    const [, , d] = await fn('devices', { action: 'register', name: 'Sim node', kind: 'pond_node', simulated: true, pond_id: pond[0].id });
    await fn('devices', { action: 'simulate', device_id: d.device.id, scenario: 'low_oxygen' });
    const [s, t, ins] = await fn('insights', { kind: 'water', id: pond[0].id, language: 'te' });
    check('water insight (te)', s === 200 && ['good', 'watch', 'act'].includes(ins.status) && ins.findings?.length > 0, `${s} ${t}ms ${ins.status} ${ins.summary?.slice(0, 140)} used=${ins.data_used}`);
    const [s2, t2, ins2] = await fn('insights', { kind: 'water', id: pond[0].id, language: 'te' });
    check('insight cached', s2 === 200 && ins2.cached === true, `${s2} ${t2}ms`);
    const [s3] = await fn('insights', { kind: 'water', id: '00000000-0000-0000-0000-000000000000', language: 'en' });
    check('insight other/missing pond', s3 === 404, s3);
    const [, farm] = await rest('farms', { method: 'POST', body: JSON.stringify({ name: 'Plan farm', soil_type: 'red', irrigation_source: 'borewell', area_acres: 3 }) });
    const [ps, pt, plan] = await fn('insights', { kind: 'planning', id: farm[0].id, language: 'hi' });
    check('crop planning insight (hi)', ps === 200 && plan.findings?.length > 0, `${ps} ${pt}ms ${plan.summary?.slice(0, 140) ?? JSON.stringify(plan)}`);
    const [, ctxr] = await rest('rpc/farm_context', { method: 'POST', body: '{}' });
    check('assistant context sees sensors', ctxr.sensors?.length === 1 && ctxr.sensors[0].simulated === true && ctxr.open_alerts?.length >= 1, JSON.stringify(ctxr.sensors?.[0]).slice(0, 200));
    const [as, at, a] = await fn('ai-assistant', { message: 'How is my pond water right now?', input_mode: 'text', language: 'en' });
    check('assistant uses sensor data', as === 200 && /oxygen|DO/i.test(a.message?.content ?? ''), `${as} ${at}ms ${a.message?.content?.slice(0, 200)}`);
  }
  if (want('satellite')) {
    const [s, , sat] = await fn('satellite', { action: 'refresh', farm_id: '00000000-0000-0000-0000-000000000000' });
    check('satellite not configured yet', s === 200 && sat.configured === false, `${s} ${JSON.stringify(sat)}`);
    const r = await fetch(`${U}/functions/v1/cron`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-cron-secret': 'nope' }, body: '{}' });
    check('cron needs its secret', r.status === 401, r.status);
  }
  for (const [name, run] of Object.entries(globalThis.extraChecks ?? {})) if (want(name)) await run(check);
} catch (e) { failures++; console.error(e); }
finally {
  if (uid) { const d = await fetch(`${U}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: admin }); log('delete test user', d.status); }
  console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
  process.exit(failures ? 1 : 0);
}
