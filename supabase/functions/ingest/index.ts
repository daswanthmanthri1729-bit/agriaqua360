// Device endpoint (ESP32 over HTTPS, or the MQTT broker's HTTP rule). No user JWT: devices authenticate with
// their own id + secret key. Body format: firmware/esp32/README.md.
// Headers x-device-id / x-device-key, or body.device_id / body.key (MQTT bridge). Returns pending equipment commands.
import { cors, fail, json } from '../_shared/http.ts';
import { admin, sha256, simSecret } from '../_shared/server.ts';
import { languageOf, notifyUser } from '../_shared/notify.ts';
import { alertText, breach, Channel, insidePolygon, latestByType, Payload, Rule, ruleFires, SensorType, validateReadings, wqSnapshot } from '../_shared/iot.ts';

let typeCache: Map<string, SensorType> | null = null;
const MIN_GAP_MS = 5_000;          // rate limit per device
const WQ_SNAPSHOT_MS = 15 * 60_000;
const SIM_SECRET = await simSecret();

function sameHash(a: string, b: string) {   // constant-time compare
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST' || !admin) return fail('bad_request', 405);
  const raw = await req.text();
  if (raw.length > 64_000) return fail('too_large', 413);
  let p: Payload & { device_id?: unknown; key?: unknown };
  try { p = JSON.parse(raw); } catch { return fail('bad_request'); }
  const deviceId = req.headers.get('x-device-id') ?? (typeof p.device_id === 'string' ? p.device_id : '');
  const key = req.headers.get('x-device-key') ?? (typeof p.key === 'string' ? p.key : '');
  if (!/^[0-9a-f-]{36}$/.test(deviceId) || (key.length < 20 && !req.headers.get('x-sim-secret')) || key.length > 100) return fail('unauthorized', 401);

  const [{ data: dev }, { data: k }] = await Promise.all([
    admin.from('sensor_devices').select('*').eq('id', deviceId).maybeSingle(),
    admin.from('device_keys').select('key_hash').eq('device_id', deviceId).maybeSingle(),
  ]);
  // The in-app simulator (devices function) calls in with a server-only secret, and only for simulated devices.
  const simCall = !!dev?.is_simulated && !!SIM_SECRET && req.headers.get('x-sim-secret') === SIM_SECRET;
  if (!dev || (!simCall && (!k || !sameHash(await sha256(key), k.key_hash)))) return fail('unauthorized', 401);
  const now = Date.now();
  if (dev.last_seen_at && now - Date.parse(dev.last_seen_at) < MIN_GAP_MS && (p.readings?.length ?? 0) > 0) return fail('too_many_requests', 429);

  const source = dev.is_simulated ? 'simulated' : 'sensor';
  if (!typeCache) {
    const { data } = await admin.from('sensor_types').select('code, unit, min_valid, max_valid');
    typeCache = new Map((data ?? []).map((t) => [t.code, { ...t, min_valid: Number(t.min_valid), max_valid: Number(t.max_valid) }]));
  }
  const { data: chData } = await admin.from('device_channels').select('channel, kind, sensor_type, enabled, calibration_offset, calibration_scale, max_run_s').eq('device_id', deviceId);
  const channels = (chData ?? []).map((c) => ({ ...c, calibration_offset: Number(c.calibration_offset), calibration_scale: Number(c.calibration_scale) })) as Channel[];
  const { accepted, rejected } = validateReadings(p, channels, typeCache, now);
  const owner = dev.owner_id as string;
  const scope = { device_id: deviceId, farm_id: dev.farm_id, pond_id: dev.pond_id, animal_id: dev.animal_id };
  let lang: string | null = null;
  const language = async () => (lang ??= await languageOf(owner));
  const tasks: PromiseLike<unknown>[] = [];

  // 1. Readings (duplicates from retries are skipped by the unique index).
  if (accepted.length) {
    const { error } = await admin.from('sensor_readings').upsert(
      accepted.map((r) => ({ owner_id: owner, ...scope, ...r, source })),
      { onConflict: 'device_id,sensor_type,recorded_at', ignoreDuplicates: true });
    if (error) { console.error('readings', error.message); return fail('store_failed', 500); }
  }
  const latest = latestByType(accepted);

  // 2. Device status.
  const battery = typeof p.battery === 'number' ? p.battery : latest.get('battery')?.value;
  tasks.push(admin.from('sensor_devices').update({
    last_seen_at: new Date(now).toISOString(), offline_alerted_at: null,
    ...(typeof battery === 'number' && battery >= 0 && battery <= 100 ? { battery_pct: battery } : {}),
    ...(typeof p.rssi === 'number' && p.rssi <= 0 && p.rssi >= -150 ? { rssi_dbm: Math.round(p.rssi) } : {}),
    ...(typeof p.fw === 'string' ? { firmware: p.fw.slice(0, 40) } : {}),
  }).eq('id', deviceId));
  tasks.push(admin.from('sensor_alerts').update({ status: 'resolved', resolved_at: new Date(now).toISOString() }).eq('device_id', deviceId).eq('kind', 'offline').neq('status', 'resolved'));

  // 3. Pond snapshot for Level 1 screens/reports/AI (at most every 15 min per device).
  const snap = dev.pond_id ? wqSnapshot(latest) : null;
  if (snap) tasks.push((async () => {
    const { data: last } = await admin.from('water_quality_records').select('recorded_at').eq('device_id', deviceId).order('recorded_at', { ascending: false }).limit(1).maybeSingle();
    if (!last || Date.parse(snap.recorded_at as string) - Date.parse(last.recorded_at) >= WQ_SNAPSHOT_MS)
      await admin.from('water_quality_records').insert({ owner_id: owner, pond_id: dev.pond_id, device_id: deviceId, source, ...snap });
  })());

  // 4. Thresholds → open / resolve alerts.
  if (latest.size) tasks.push((async () => {
    const ors = [`device_id.eq.${deviceId}`, dev.pond_id && `pond_id.eq.${dev.pond_id}`, dev.farm_id && `farm_id.eq.${dev.farm_id}`].filter(Boolean).join(',');
    const { data: ths } = await admin.from('sensor_thresholds').select('sensor_type, min_value, max_value, device_id').eq('owner_id', owner).eq('enabled', true).or(ors);
    // A device-specific threshold wins over a pond/farm one for the same parameter.
    const pick = new Map<string, { sensor_type: string; min_value: number | null; max_value: number | null }>();
    for (const t of ths ?? []) if (!pick.has(t.sensor_type) || t.device_id) pick.set(t.sensor_type, { sensor_type: t.sensor_type, min_value: t.min_value == null ? null : Number(t.min_value), max_value: t.max_value == null ? null : Number(t.max_value) });
    for (const [type, r] of latest) {
      const t = pick.get(type);
      if (!t) continue;
      const b = breach(t, r.value);
      if (!b) {
        await admin.from('sensor_alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('device_id', deviceId).eq('sensor_type', type).in('kind', ['low', 'high']).neq('status', 'resolved');
        continue;
      }
      const { error } = await admin.from('sensor_alerts').insert({ owner_id: owner, ...scope, sensor_type: type, kind: b.kind, value: r.value, limit_value: b.limit, source });
      if (error) continue; // already an open alert for this (unique index)
      await notifyUser(owner, {
        category: 'sensor', priority: type === 'water_do' ? 'high' : 'normal',
        title: alertText(b.kind, await language(), { p: type, v: r.value, l: b.limit }, dev.is_simulated),
        body: dev.name, route: `/monitor/device/${deviceId}`, data: { device_id: deviceId, sensor_type: type },
      });
    }
  })());

  // 5. Impossible values: one open alert per channel until a good reading resolves it.
  for (const r of rejected.filter((x) => x.reason === 'out_of_range')) {
    const type = channels.find((c) => c.channel === r.channel)?.sensor_type ?? null;
    tasks.push(admin.from('sensor_alerts').insert({ owner_id: owner, ...scope, sensor_type: type, kind: 'rejected', value: r.value, source }).then(async ({ error }) => {
      if (!error) await notifyUser(owner, { category: 'device', title: alertText('rejected', await language(), { d: dev.name, p: type ?? '' }, dev.is_simulated), body: alertText('rejected_body', await language(), { v: r.value }), route: `/monitor/device/${deviceId}` });
    }));
  }
  for (const type of latest.keys()) tasks.push(admin.from('sensor_alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('device_id', deviceId).eq('sensor_type', type).eq('kind', 'rejected').neq('status', 'resolved'));

  // 6. Actuator states reported by the device (its local switch always wins).
  for (const [ch, s] of Object.entries(p.actuators ?? {}).slice(0, 16)) {
    if (!channels.some((c) => c.channel === ch && c.kind === 'actuator')) continue;
    const state = s?.state === 'on' || s?.state === 'off' ? s.state : 'unknown';
    tasks.push(admin.from('device_channels').update({ state, state_at: new Date(now).toISOString(), manual_override: s?.manual === true }).eq('device_id', deviceId).eq('channel', ch));
  }
  // 7. Command acknowledgements.
  for (const a of (p.acks ?? []).slice(0, 20)) {
    if (typeof a?.id !== 'string') continue;
    tasks.push(admin.from('actuator_commands').update({ status: a.ok === true ? 'done' : 'failed', finished_at: new Date(now).toISOString(), result: typeof a.msg === 'string' ? a.msg.slice(0, 200) : null })
      .eq('id', a.id).eq('device_id', deviceId).eq('status', 'sent'));
  }

  // 8. Automation rules: only real sensor data can switch real equipment.
  if (!dev.is_simulated && latest.size) tasks.push((async () => {
    const { data: rules } = await admin.from('automation_rules').select('*').eq('sensor_device_id', deviceId).eq('enabled', true);
    for (const rule of (rules ?? []) as (Rule & { target_device_id: string; target_channel: string; action: string; duration_s: number | null; owner_id: string })[]) {
      const r = latest.get(rule.sensor_type);
      if (!r || !ruleFires({ ...rule, threshold: Number(rule.threshold) }, r.value, now)) continue;
      const { data: tgt } = await admin.from('device_channels').select('manual_override, max_run_s, enabled').eq('device_id', rule.target_device_id).eq('channel', rule.target_channel).maybeSingle();
      if (!tgt?.enabled || tgt.manual_override) continue;
      await admin.from('actuator_commands').insert({ owner_id: rule.owner_id, device_id: rule.target_device_id, channel: rule.target_channel, action: rule.action, duration_s: rule.action === 'on' ? Math.min(rule.duration_s ?? 60, tgt.max_run_s ?? 60) : null, requested_by: 'rule', rule_id: rule.id });
      await admin.from('automation_rules').update({ last_fired_at: new Date(now).toISOString() }).eq('id', rule.id);
    }
  })());

  // 9. Livestock collar location + geofence.
  const loc = p.location;
  if (dev.animal_id && typeof loc?.lat === 'number' && typeof loc?.lon === 'number' && Math.abs(loc.lat) <= 90 && Math.abs(loc.lon) <= 180) tasks.push((async () => {
    await admin.from('animal_locations').insert({ owner_id: owner, animal_id: dev.animal_id, device_id: deviceId, latitude: loc.lat, longitude: loc.lon, accuracy_m: typeof loc.acc === 'number' ? Math.min(loc.acc, 99999) : null, source });
    const { data: fences } = await admin.from('geofences').select('polygon').eq('owner_id', owner).eq('enabled', true);
    if (!fences?.length) return;
    const inside = fences.some((f) => insidePolygon(loc.lon as number, loc.lat as number, f.polygon));
    if (inside) { await admin.from('sensor_alerts').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('animal_id', dev.animal_id).eq('kind', 'geofence').neq('status', 'resolved'); return; }
    const { error } = await admin.from('sensor_alerts').insert({ owner_id: owner, ...scope, kind: 'geofence', source });
    if (!error) await notifyUser(owner, { category: 'location', priority: 'high', title: alertText('geofence', await language(), { d: dev.name }, dev.is_simulated), route: `/livestock/animals/${dev.animal_id}` });
  })());

  const results = await Promise.allSettled(tasks);
  results.forEach((r) => r.status === 'rejected' && console.error('ingest task', String(r.reason)));

  // 10. Deliver pending commands (and expire stale ones so they never run late).
  await admin.from('actuator_commands').update({ status: 'expired' }).eq('device_id', deviceId).eq('status', 'pending').lt('expires_at', new Date(now).toISOString());
  const { data: cmds } = await admin.from('actuator_commands').update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('device_id', deviceId).eq('status', 'pending').select('id, channel, action, duration_s');
  return json({ ok: true, accepted: accepted.length, rejected, commands: cmds ?? [], interval_s: dev.reporting_interval_s, source });
});
