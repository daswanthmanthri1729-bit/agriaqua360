// AI analysis built only from the farmer's own recorded data (never invents readings, prices or results).
// POST { kind: 'water' | 'soil' | 'crop' | 'livestock' | 'finance', id?, language, extra? }
//  → { status: 'good'|'watch'|'act', summary, findings[], actions[], data_used[], generated_at, cached }
// Cached until the underlying data changes (fingerprint), so repeated opens don't spend AI quota.
import { cors, fail, json } from '../_shared/http.ts';
import { cached, caller } from '../_shared/server.ts';
import { CHAT_MODELS, generateJson, languageName } from '../_shared/gemini.ts';

const schema = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING', enum: ['good', 'watch', 'act'] },
    summary: { type: 'STRING' },
    findings: { type: 'ARRAY', items: { type: 'STRING' } },
    actions: { type: 'ARRAY', items: { type: 'STRING' } },
    see_expert: { type: 'BOOLEAN' },
  },
  required: ['status', 'summary', 'findings', 'actions', 'see_expert'],
};

const GUIDE: Record<string, string> = {
  water: 'Assess pond water quality for the species. Typical safe ranges: DO > 5 mg/L (critical < 3), pH 7.0–8.5, temperature 26–32 °C for warm-water species, total ammonia < 0.5 mg/L, Secchi transparency 30–45 cm. Note dawn DO dips. Mention feeding reduction or aeration when oxygen is low.',
  soil: 'Explain the soil for the farmer. Lab test results are measurements; SoilGrids values are modelled estimates (say so); sensor values are live measurements. Give fertiliser/lime/organic-matter guidance in general terms and recommend a Soil Health Card test when there is no lab test.',
  crop: 'Assess crop growth stage, harvest readiness and risks from sowing date, stage, weather and satellite NDVI if given. Say clearly when data is missing. Do not promise a yield.',
  livestock: 'Give preliminary health and productivity guidance for this animal from its records (health, vaccinations, weight, milk, collar sensors if present). This does not replace a veterinarian; set see_expert true for any illness sign, fever (> 39.5 °C cattle) or sudden milk drop.',
  planning: 'Suggest up to 3 crops (or crop + fish/livestock options if the farmer has those sectors) for the coming season on this farm. For each: why it suits the soil, water source, season and location; water need (low/medium/high); main risk. Do not quote prices or yields as numbers. Tell the farmer to confirm varieties with the local KVK or agriculture officer.',
  finance: 'Review income and costs. Point out the largest costs and practical ways to reduce them, and which crop/pond/animal is most and least profitable. Use only the given amounts (₹).',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const who = await caller(req);
  if (!who) return fail('unauthorized', 401);
  let b: { kind?: string; id?: string; language?: string; extra?: unknown };
  try { b = await req.json(); } catch { return fail('bad_request'); }
  const kind = String(b.kind);
  if (!GUIDE[kind]) return fail('bad_request');
  const language = ['en', 'te', 'hi'].includes(b.language as string) ? b.language! : 'en';
  const id = typeof b.id === 'string' ? b.id : '';
  const sb = who.sb;
  const since = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

  // Collect the data (all under the caller's RLS).
  let data: Record<string, unknown> = {};
  if (kind === 'water') {
    const [{ data: pond }, { data: wq }, { data: live }] = await Promise.all([
      sb.from('ponds').select('name, species, area_acres, depth_m, stocking_date, stocking_count').eq('id', id).maybeSingle(),
      sb.from('water_quality_records').select('recorded_at, source, ph, dissolved_oxygen_mgl, temperature_c, ammonia_mgl, salinity_ppt, turbidity_cm, turbidity_ntu, water_level_cm').eq('pond_id', id).gte('recorded_at', since(7)).order('recorded_at', { ascending: false }).limit(40),
      sb.from('latest_sensor_values').select('sensor_type, value, source, recorded_at').eq('pond_id', id),
    ]);
    if (!pond) return fail('not_found', 404);
    data = { pond, readings_last_7_days: wq ?? [], latest_sensor_values: live ?? [] };
  } else if (kind === 'soil') {
    const [{ data: farm }, { data: tests }, { data: live }] = await Promise.all([
      sb.from('farms').select('name, soil_type, irrigation_source, area_acres').eq('id', id).maybeSingle(),
      sb.from('soil_tests').select('*').eq('farm_id', id).order('tested_on', { ascending: false }).limit(2),
      sb.from('latest_sensor_values').select('sensor_type, value, source, recorded_at').eq('farm_id', id),
    ]);
    if (!farm) return fail('not_found', 404);
    data = { farm, lab_tests: tests ?? [], soil_sensors: (live ?? []).filter((r) => r.sensor_type.startsWith('soil')), soilgrids_estimate: b.extra ?? null };
  } else if (kind === 'crop') {
    const { data: crop } = await sb.from('crops').select('id, farm_id, name, variety, season, area_acres, sowing_date, expected_harvest_date, growth_stage, status').eq('id', id).maybeSingle();
    if (!crop) return fail('not_found', 404);
    const [{ data: recs }, { data: sat }] = await Promise.all([
      sb.from('crop_records').select('activity, scheduled_for, completed_at, quantity, unit').eq('crop_id', id).order('scheduled_for', { ascending: false }).limit(20),
      sb.from('satellite_observations').select('acquired_at, ndvi_mean, stress_pct, cloud_pct').eq('farm_id', crop.farm_id).order('acquired_at', { ascending: false }).limit(6),
    ]);
    data = { today: new Date().toISOString().slice(0, 10), crop, activities: recs ?? [], satellite_ndvi: sat ?? [], weather: b.extra ?? null };
  } else if (kind === 'livestock') {
    const [{ data: animal }, { data: health }, { data: vacc }, { data: recs }, { data: live }] = await Promise.all([
      sb.from('livestock').select('species, breed, sex, birth_date, weight_kg, status').eq('id', id).maybeSingle(),
      sb.from('animal_health_records').select('record_type, recorded_on, description').eq('animal_id', id).order('recorded_on', { ascending: false }).limit(10),
      sb.from('vaccination_records').select('vaccine_name, given_on, due_on, status').eq('animal_id', id).order('due_on', { ascending: false }).limit(10),
      sb.from('animal_records').select('record_type, recorded_on, value, session, detail').eq('animal_id', id).gte('recorded_on', since(60).slice(0, 10)).order('recorded_on', { ascending: false }).limit(80),
      sb.from('latest_sensor_values').select('sensor_type, value, source, recorded_at').eq('animal_id', id),
    ]);
    if (!animal) return fail('not_found', 404);
    data = { today: new Date().toISOString().slice(0, 10), animal, health: health ?? [], vaccinations: vacc ?? [], production_records: recs ?? [], collar: live ?? [] };
  } else if (kind === 'planning') {
    const [{ data: farm }, { data: tests }, { data: crops }, { data: prof }] = await Promise.all([
      sb.from('farms').select('name, soil_type, irrigation_source, area_acres, district, state').eq('id', id).maybeSingle(),
      sb.from('soil_tests').select('tested_on, ph, ec_dsm, organic_carbon_pct, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha').eq('farm_id', id).order('tested_on', { ascending: false }).limit(1),
      sb.from('crops').select('name, season, status, sowing_date').eq('farm_id', id).order('created_at', { ascending: false }).limit(10),
      sb.from('profiles').select('district, state, sectors').eq('id', who.uid).maybeSingle(),
    ]);
    if (!farm) return fail('not_found', 404);
    data = { today: new Date().toISOString().slice(0, 10), farm, latest_soil_test: tests?.[0] ?? null, past_crops: crops ?? [], farmer: prof };
  } else if (kind === 'finance') {
    const from = since(365).slice(0, 10), to = new Date().toISOString().slice(0, 10);
    const [{ data: sum }, { data: tx }] = await Promise.all([
      sb.rpc('finance_summary', { p_from: from, p_to: to }),
      sb.from('farm_transactions').select('kind, category, amount, occurred_on').gte('occurred_on', from).limit(500),
    ]);
    const byCat: Record<string, number> = {};
    (tx ?? []).forEach((t) => { byCat[`${t.kind}:${t.category}`] = (byCat[`${t.kind}:${t.category}`] ?? 0) + Number(t.amount); });
    data = { period: { from, to }, summary: sum ?? [], totals_by_category: byCat };
  }

  const fingerprint = JSON.stringify(data).length + ':' + (await crypto.subtle.digest('SHA-1', new TextEncoder().encode(JSON.stringify(data))).then((h) => Array.from(new Uint8Array(h).slice(0, 8), (x) => x.toString(16).padStart(2, '0')).join('')));
  try {
    const res = await cached(`ins:${who.uid}:${kind}:${id}:${language}:${fingerprint}`, 24 * 3600_000, () => generateJson<Record<string, unknown>>({
      system: `You are AgriAqua 360's farm analyst for Indian farmers. Reply in ${languageName(language)}, simple words. ${GUIDE[kind]} ` +
        'Use ONLY the data given; if something is missing, say it is missing instead of guessing. Never invent readings, prices, test results or dates. ' +
        'Readings with source "simulated" are demo data — say so if you use them. Max 4 findings and 4 actions, each one short sentence. ' +
        'status: good = nothing to do, watch = keep an eye, act = do something soon.',
      parts: [{ text: JSON.stringify(data) }],
      schema, temperature: 0.2, maxOutputTokens: 900, models: CHAT_MODELS, thinking: 'minimal',
    }));
    const used = Object.entries(data).filter(([, v]) => v && (!Array.isArray(v) || v.length)).map(([k]) => k);
    return json({ ...res.data, data_used: used, generated_at: res.fetched_at, cached: res.cached });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('insights', kind, msg);
    return fail(msg === 'ai_not_configured' ? 'ai_not_configured' : 'ai_busy', 503);
  }
});
