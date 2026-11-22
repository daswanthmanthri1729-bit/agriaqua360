// Sentinel-2 vegetation monitoring for a farm boundary via Copernicus Data Space Ecosystem (Sentinel Hub APIs).
// POST { action: 'refresh', farm_id, days? }  → NDVI statistics per cloud-free acquisition, stored in satellite_observations
// POST { action: 'image', farm_id, date }     → NDVI colour image for that date, saved to the farmer's storage folder
// Needs CDSE_CLIENT_ID / CDSE_CLIENT_SECRET (free account). Nothing is ever estimated: no data → no row.
import { cors, fail, json } from '../_shared/http.ts';
import { admin, cached, caller, timedFetch, Upstream } from '../_shared/server.ts';

const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const SH = 'https://sh.dataspace.copernicus.eu/api/v1';
const PROVIDER = 'Copernicus Sentinel-2 L2A (CDSE)';
const MAX_HA = 1000;

// NDVI with clouds, cloud shadows and cirrus masked out by the scene classification (SCL 3, 8, 9, 10).
const STATS_SCRIPT = `//VERSION=3
function setup(){return{input:[{bands:["B04","B08","SCL","dataMask"]}],output:[{id:"ndvi",bands:1,sampleType:"FLOAT32"},{id:"stress",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]}}
function evaluatePixel(s){var n=(s.B08-s.B04)/(s.B08+s.B04+1e-6);var clear=s.dataMask===1&&[3,8,9,10].indexOf(s.SCL)<0;return{ndvi:[n],stress:[n<0.3?1:0],dataMask:[clear?1:0]}}`;
const IMAGE_SCRIPT = `//VERSION=3
function setup(){return{input:[{bands:["B04","B08","SCL","dataMask"]}],output:{bands:4}}}
var ramp=[[-0.2,0xa50026],[0.1,0xf46d43],[0.3,0xfee08b],[0.5,0xa6d96a],[0.7,0x1a9850],[0.9,0x006837]];
var viz=new ColorRampVisualizer(ramp);
function evaluatePixel(s){var n=(s.B08-s.B04)/(s.B08+s.B04+1e-6);var clear=s.dataMask===1&&[3,8,9,10].indexOf(s.SCL)<0;var c=viz.process(n);return[c[0],c[1],c[2],clear?1:0]}`;

let token: { value: string; until: number } | null = null;
async function cdseToken() {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const r = await timedFetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: Deno.env.get('CDSE_CLIENT_ID')!, client_secret: Deno.env.get('CDSE_CLIENT_SECRET')! }) }, 10_000);
  if (!r.ok) throw new Upstream('satellite_key_invalid');
  const t = await r.json();
  token = { value: t.access_token, until: Date.now() + (t.expires_in ?? 300) * 1000 };
  return token.value;
}

/** Shoelace area on an equirectangular projection — fine for farm-sized polygons. */
export function areaHa(poly: number[][]) {
  const lat0 = (poly.reduce((s, p) => s + p[1], 0) / poly.length) * Math.PI / 180;
  const k = 111_320;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * Math.cos(lat0) * k * y2 * k - x2 * Math.cos(lat0) * k * y1 * k;
  }
  return Math.abs(a) / 2 / 10_000;
}

const geometry = (poly: number[][]) => ({ type: 'Polygon', coordinates: [[...poly, poly[0]]] });
const input = (poly: number[][], from: string, to: string) => ({
  bounds: { geometry: geometry(poly), properties: { crs: 'http://www.opengis.net/def/crs/OGC/1.3/CRS84' } },
  data: [{ type: 'sentinel-2-l2a', dataFilter: { timeRange: { from, to }, maxCloudCoverage: 90, mosaickingOrder: 'leastCC' } }],
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const who = await caller(req);
  if (!who || !admin) return fail('unauthorized', 401);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return fail('bad_request'); }
  if (!Deno.env.get('CDSE_CLIENT_ID') || !Deno.env.get('CDSE_CLIENT_SECRET')) return json({ configured: false });

  const { data: farm } = await who.sb.from('farms').select('id, boundary').eq('id', String(b.farm_id ?? '')).maybeSingle();  // RLS: own/member farm
  if (!farm) return fail('not_found', 404);
  const poly = farm.boundary as number[][] | null;
  if (!poly || poly.length < 3) return json({ configured: true, error: 'no_boundary' }, 400);
  const ha = areaHa(poly);
  if (ha > MAX_HA) return fail('boundary_too_large');

  try {
    if (b.action === 'refresh') {
      const days = Math.min(365, Math.max(30, Number(b.days) || 120));
      const to = new Date(), from = new Date(to.getTime() - days * 86_400_000);
      const res = await cached(`sat:${farm.id}:${days}:${JSON.stringify(poly).length}`, 12 * 3600_000, async () => {
        const r = await timedFetch(`${SH}/statistics`, {
          method: 'POST', headers: { Authorization: `Bearer ${await cdseToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: input(poly, from.toISOString(), to.toISOString()),
            aggregation: { timeRange: { from: from.toISOString(), to: to.toISOString() }, aggregationInterval: { of: 'P1D' }, evalscript: STATS_SCRIPT, resx: 0.0001, resy: 0.0001 },
          }),
        }, 30_000);
        if (r.status === 401 || r.status === 403) throw new Upstream('satellite_key_invalid');
        if (!r.ok) throw new Upstream(`statistics ${r.status} ${(await r.text()).slice(0, 300)}`);
        const out = await r.json();
        const rows = [];
        for (const d of out.data ?? []) {
          const s = d.outputs?.ndvi?.bands?.B0?.stats, st = d.outputs?.stress?.bands?.B0?.stats;
          if (!s || !s.sampleCount) continue;
          const valid = ((s.sampleCount - s.noDataCount) / s.sampleCount) * 100;
          if (valid < 20 || typeof s.mean !== 'number' || Number.isNaN(s.mean)) continue;   // mostly cloud over the field: skip, never guess
          const date = d.interval.from.slice(0, 10);
          rows.push({
            owner_id: who.uid, farm_id: farm.id, provider: PROVIDER, scene_id: `S2L2A:${date}`, acquired_at: d.interval.from,
            cloud_pct: Math.round((100 - valid) * 100) / 100, valid_pixel_pct: Math.round(valid * 100) / 100, resolution_m: 10,
            ndvi_mean: Math.round(s.mean * 1000) / 1000, ndvi_min: Math.round(s.min * 1000) / 1000, ndvi_max: Math.round(s.max * 1000) / 1000,
            stress_pct: typeof st?.mean === 'number' ? Math.round(st.mean * 10000) / 100 : null,
          });
        }
        if (rows.length) { const { error } = await admin!.from('satellite_observations').upsert(rows, { onConflict: 'farm_id,scene_id' }); if (error) throw error; }
        return { scenes: rows.length };
      });
      const { data: obs } = await who.sb.from('satellite_observations').select('*').eq('farm_id', farm.id).order('acquired_at', { ascending: false }).limit(60);
      return json({ configured: true, provider: PROVIDER, area_ha: Math.round(ha * 100) / 100, observations: obs ?? [], cached: res.cached, fetched_at: res.fetched_at });
    }

    if (b.action === 'image') {
      const date = String(b.date ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('bad_request');
      const path = `${who.uid}/satellite/${farm.id}/${date}.png`;
      const { data: exists } = await admin!.storage.from('media').list(`${who.uid}/satellite/${farm.id}`, { search: `${date}.png` });
      if (!exists?.length) {
        const r = await timedFetch(`${SH}/process`, {
          method: 'POST', headers: { Authorization: `Bearer ${await cdseToken()}`, 'Content-Type': 'application/json', Accept: 'image/png' },
          body: JSON.stringify({ input: input(poly, `${date}T00:00:00Z`, `${date}T23:59:59Z`), output: { width: 512, height: 512, responses: [{ identifier: 'default', format: { type: 'image/png' } }] }, evalscript: IMAGE_SCRIPT }),
        }, 30_000);
        if (!r.ok) throw new Upstream(`process ${r.status}`);
        const { error } = await admin!.storage.from('media').upload(path, new Uint8Array(await r.arrayBuffer()), { contentType: 'image/png', upsert: true });
        if (error) throw error;
      }
      return json({ configured: true, path, date, provider: PROVIDER, resolution_m: 10 });
    }
    return fail('bad_request');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('satellite', msg);
    return fail(msg === 'satellite_key_invalid' ? 'satellite_key_invalid' : 'satellite_unavailable', 502);
  }
});
