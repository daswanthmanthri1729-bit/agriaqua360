// Device management for the signed-in owner.
// POST { action: 'register', name, kind, simulated?, farm_id?, pond_id?, animal_id?, sensors?, actuators?, transport? }
//        → { device, secret } — the secret is shown ONCE; only its hash is stored.
// POST { action: 'rotate_key', device_id }      → { secret }
// POST { action: 'simulate', device_id, scenario?, backfill_hours? }  → simulated readings (always labelled)
import { cors, fail, json } from '../_shared/http.ts';
import { admin, caller, sha256, simSecret } from '../_shared/server.ts';
import { DEFAULT_THRESHOLDS, KIND_SENSORS, Scenario, SCENARIOS, simulateValue } from '../_shared/iot.ts';

const KINDS = ['field_node', 'pond_node', 'gateway', 'controller', 'collar'];
const ACT_TYPES = ['pump', 'valve', 'aerator', 'feeder', 'other'];
const MAX_DEVICES = 50;

function newSecret() {
  const b = crypto.getRandomValues(new Uint8Array(24));
  return 'aq_' + btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function setKey(deviceId: string) {
  const secret = newSecret();
  const { error } = await admin!.from('device_keys').upsert({ device_id: deviceId, key_hash: await sha256(secret), key_prefix: secret.slice(0, 7), rotated_at: new Date().toISOString() });
  if (error) throw error;
  return secret;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const who = await caller(req);
  if (!who || !admin) return fail('unauthorized', 401);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return fail('bad_request'); }
  const { sb, uid } = who;
  const ingestUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ingest`;

  try {
    if (b.action === 'register') {
      const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
      const kind = String(b.kind);
      if (!name || !KINDS.includes(kind)) return fail('bad_request');
      const { count } = await admin.from('sensor_devices').select('id', { count: 'exact', head: true }).eq('owner_id', uid);
      if ((count ?? 0) >= MAX_DEVICES) return fail('device_limit', 409);
      // Links must point at the caller's own farm / pond / animal (checked under their RLS).
      const own = async (table: string, id: unknown) => typeof id !== 'string' ? null : (await sb.from(table).select('id').eq('id', id).maybeSingle()).data?.id ?? false;
      const [farm, pond, animal] = await Promise.all([own('farms', b.farm_id), own('ponds', b.pond_id), own('livestock', b.animal_id)]);
      if (farm === false || pond === false || animal === false) return fail('not_found', 404);

      const sensors = (Array.isArray(b.sensors) ? b.sensors : KIND_SENSORS[kind] ?? []).filter((s): s is string => typeof s === 'string').slice(0, 24);
      const { data: types } = await admin.from('sensor_types').select('code').in('code', sensors.length ? sensors : ['-']);
      if ((types?.length ?? 0) !== new Set(sensors).size) return fail('bad_request');
      const actuators = (Array.isArray(b.actuators) ? b.actuators : []).slice(0, 16) as { channel?: unknown; type?: unknown; label?: unknown; max_run_s?: unknown }[];
      if (!actuators.every((a) => typeof a.channel === 'string' && /^[a-z0-9_]{1,32}$/.test(a.channel) && ACT_TYPES.includes(String(a.type)) && Number(a.max_run_s) >= 10 && Number(a.max_run_s) <= 14400)) return fail('bad_request');
      if (actuators.length && b.simulated === true) return fail('bad_request'); // simulated devices never control equipment

      const { data: dev, error } = await admin.from('sensor_devices').insert({
        owner_id: uid, name, kind, is_simulated: b.simulated === true, farm_id: farm, pond_id: pond, animal_id: animal,
        transport: b.transport === 'mqtt' ? 'mqtt' : 'https',
        reporting_interval_s: b.simulated === true ? 900 : 300,
      }).select().single();
      if (error) throw error;
      try {
        const rows = [
          ...[...new Set(sensors)].map((s) => ({ owner_id: uid, device_id: dev.id, channel: s, kind: 'sensor', sensor_type: s })),
          ...actuators.map((a) => ({ owner_id: uid, device_id: dev.id, channel: a.channel, kind: 'actuator', actuator_type: a.type, label: typeof a.label === 'string' ? a.label.slice(0, 60) : null, max_run_s: Math.round(Number(a.max_run_s)), state: 'unknown' })),
        ];
        if (rows.length) { const { error: e } = await admin.from('device_channels').insert(rows); if (e) throw e; }
        const ths = sensors.filter((s) => DEFAULT_THRESHOLDS[s]).map((s) => ({ owner_id: uid, device_id: dev.id, sensor_type: s, min_value: DEFAULT_THRESHOLDS[s].min ?? null, max_value: DEFAULT_THRESHOLDS[s].max ?? null }));
        if (ths.length) await admin.from('sensor_thresholds').insert(ths);
        const secret = b.simulated === true ? null : await setKey(dev.id);
        return json({ device: dev, secret, ingest_url: ingestUrl, mqtt_topic: `agriaqua/${dev.id}/up` });
      } catch (e) {
        await admin.from('sensor_devices').delete().eq('id', dev.id);   // no half-registered devices
        throw e;
      }
    }

    const deviceId = typeof b.device_id === 'string' ? b.device_id : '';
    const { data: dev } = await sb.from('sensor_devices').select('id, is_simulated, kind').eq('id', deviceId).maybeSingle();  // RLS: own only
    if (!dev) return fail('not_found', 404);

    if (b.action === 'rotate_key') {
      if (dev.is_simulated) return fail('bad_request');
      return json({ secret: await setKey(dev.id), ingest_url: ingestUrl });
    }

    if (b.action === 'simulate') {
      if (!dev.is_simulated) return fail('not_simulated', 400);
      const scenario: Scenario = SCENARIOS.includes(b.scenario as Scenario) ? (b.scenario as Scenario) : 'normal';
      const { data: chs } = await admin.from('device_channels').select('channel, sensor_type').eq('device_id', dev.id).eq('kind', 'sensor').eq('enabled', true);
      const { data: full } = await admin.from('sensor_devices').select('owner_id, farm_id, pond_id, animal_id').eq('id', dev.id).single();
      // History for charts goes straight in (no alerts for the past); the current reading goes through ingest like a real device.
      const hours = Math.min(168, Math.max(0, Math.round(Number(b.backfill_hours) || 0)));
      if (hours) {
        const rows = [];
        for (let t = Date.now() - hours * 3600_000; t < Date.now() - 60_000; t += 15 * 60_000)
          for (const c of chs ?? []) rows.push({ ...full, device_id: dev.id, sensor_type: c.sensor_type, value: simulateValue(c.sensor_type!, new Date(t)), source: 'simulated', recorded_at: new Date(t).toISOString() });
        for (let i = 0; i < rows.length; i += 1000) {
          const { error } = await admin.from('sensor_readings').upsert(rows.slice(i, i + 1000), { onConflict: 'device_id,sensor_type,recorded_at', ignoreDuplicates: true });
          if (error) throw error;
        }
      }
      const now = new Date();
      const readings = (chs ?? []).map((c) => ({ s: c.channel, v: simulateValue(c.sensor_type!, now, scenario), t: Math.floor(now.getTime() / 1000) }));
      const location = dev.kind === 'collar' ? { lat: 16.5 + (scenario === 'normal' ? 0 : 0.05), lon: 80.2, acc: 8 } : undefined;
      const r = await fetch(ingestUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-device-id': dev.id, 'x-sim-secret': await simSecret() }, body: JSON.stringify({ readings, battery: 88, rssi: -60, fw: 'simulator', location }) });
      const out = await r.json().catch(() => ({}));
      return json({ scenario, backfilled_hours: hours, ...out }, r.status);
    }
    return fail('bad_request');
  } catch (e) {
    console.error('devices', e instanceof Error ? e.message : JSON.stringify(e));
    return fail('device_failed', 500);
  }
});
