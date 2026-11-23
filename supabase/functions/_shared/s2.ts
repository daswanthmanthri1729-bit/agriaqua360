// Keyless Sentinel-2 L2A NDVI: scenes found in Element 84 Earth Search (STAC), pixels read straight from the
// public Cloud-Optimized GeoTIFFs on AWS — only the window around the field is downloaded.
import { fromUrl } from 'npm:geotiff@2.1.3';
import proj4 from 'npm:proj4@2.12.1';
import { insidePolygon } from './iot.ts';

export const STAC_SEARCH = 'https://earth-search.aws.element84.com/v1/search';
export const EARTH_SEARCH = 'Sentinel-2 L2A (Earth Search, AWS)';
const MASK = new Set([0, 1, 3, 8, 9, 10]);   // SCL: no data, saturated, cloud shadow, cloud medium/high, cirrus

export type Scene = { id: string; datetime: string; cloud: number; epsg: number; red: string; nir: string; scl: string; scale: number; offset: number };

export async function searchScenes(poly: number[][], from: string, to: string, limit = 40): Promise<Scene[]> {
  const r = await fetch(STAC_SEARCH, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({ collections: ['sentinel-2-c1-l2a'], intersects: { type: 'Polygon', coordinates: [[...poly, poly[0]]] }, datetime: `${from}/${to}`,
      query: { 'eo:cloud_cover': { lt: 90 } }, sortby: [{ field: 'properties.datetime', direction: 'desc' }], limit }),
  });
  if (!r.ok) throw new Error(`stac ${r.status} ${(await r.text()).slice(0, 200)}`);
  // deno-lint-ignore no-explicit-any
  return ((await r.json()).features ?? []).map((f: any) => {
    const p = f.properties, band = f.assets.red?.['raster:bands']?.[0] ?? {};
    return { id: f.id, datetime: p.datetime, cloud: p['eo:cloud_cover'], epsg: Number(p['proj:epsg'] ?? String(p['proj:code'] ?? '').split(':')[1]),
      red: f.assets.red?.href, nir: f.assets.nir?.href, scl: f.assets.scl?.href, scale: band.scale ?? 1e-4, offset: band.offset ?? 0 };
  }).filter((s: Scene) => s.red && s.nir && s.scl && s.epsg > 32600 && s.epsg < 32761);
}

const utm = (epsg: number) => `+proj=utm +zone=${epsg % 100} ${epsg > 32700 ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`;

/** NDVI of each 10 m pixel inside the field (NaN = outside, cloud or no data). null when the scene does not cover the field. */
export async function fieldNdvi(s: Scene, poly: number[][]) {
  const fwd = proj4('EPSG:4326', utm(s.epsg)).forward;
  const pts = poly.map(([lon, lat]) => fwd([lon, lat]) as number[]);
  const [red, nir, scl] = await Promise.all([s.red, s.nir, s.scl].map(async (u) => (await fromUrl(u)).getImage()));
  const [ox, oy] = red.getOrigin(), [rx, ry] = red.getResolution();   // ry < 0
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const c0 = Math.max(0, Math.floor((Math.min(...xs) - ox) / rx)), c1 = Math.min(red.getWidth(), Math.ceil((Math.max(...xs) - ox) / rx));
  const r0 = Math.max(0, Math.floor((Math.max(...ys) - oy) / ry)), r1 = Math.min(red.getHeight(), Math.ceil((Math.min(...ys) - oy) / ry));
  const w = c1 - c0, h = r1 - r0;
  if (w <= 0 || h <= 0) return null;
  const k = scl.getWidth() / red.getWidth();   // SCL is 20 m: read the matching window, resampled to 10 m
  const window = [c0, r0, c1, r1];
  const [R, N, C] = await Promise.all([
    red.readRasters({ window, samples: [0] }), nir.readRasters({ window, samples: [0] }),
    scl.readRasters({ window: [Math.floor(c0 * k), Math.floor(r0 * k), Math.ceil(c1 * k), Math.ceil(r1 * k)], width: w, height: h, samples: [0], resampleMethod: 'nearest' }),
  ]) as unknown as ArrayLike<number>[][];
  const ndvi = new Float32Array(w * h).fill(NaN);
  let inside = 0, clear = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!insidePolygon(ox + (c0 + x + 0.5) * rx, oy + (r0 + y + 0.5) * ry, pts)) continue;
    inside++;
    const i = y * w + x, dr = R[0][i], dn = N[0][i];
    if (!dr || !dn || MASK.has(C[0][i])) continue;
    const a = dr * s.scale + s.offset, b = dn * s.scale + s.offset;
    if (a + b <= 0) continue;
    ndvi[i] = (b - a) / (b + a);
    clear++;
  }
  return inside ? { w, h, ndvi, inside, clear } : null;
}

export function ndviStats(g: { ndvi: Float32Array; inside: number; clear: number }) {
  let sum = 0, min = Infinity, max = -Infinity, stress = 0;
  for (const v of g.ndvi) if (!Number.isNaN(v)) { sum += v; if (v < min) min = v; if (v > max) max = v; if (v < 0.3) stress++; }
  return { valid: (g.clear / g.inside) * 100, mean: sum / g.clear, min, max, stress: (stress / g.clear) * 100 };
}

// Same colour ramp as the Copernicus image script.
const RAMP: [number, number][] = [[-0.2, 0xa50026], [0.1, 0xf46d43], [0.3, 0xfee08b], [0.5, 0xa6d96a], [0.7, 0x1a9850], [0.9, 0x006837]];
export function rampColor(n: number): [number, number, number] {
  if (n <= RAMP[0][0]) return rgb(RAMP[0][1]);
  for (let i = 1; i < RAMP.length; i++) if (n <= RAMP[i][0]) {
    const t = (n - RAMP[i - 1][0]) / (RAMP[i][0] - RAMP[i - 1][0]), a = rgb(RAMP[i - 1][1]), b = rgb(RAMP[i][1]);
    return [0, 1, 2].map((j) => Math.round(a[j] + (b[j] - a[j]) * t)) as [number, number, number];
  }
  return rgb(RAMP[RAMP.length - 1][1]);
}
const rgb = (c: number): [number, number, number] => [c >> 16, (c >> 8) & 255, c & 255];

/** NDVI grid → RGBA PNG (transparent where masked), scaled up by whole pixels to about 512 px. */
export async function ndviPng(g: { w: number; h: number; ndvi: Float32Array }) {
  const z = Math.max(1, Math.floor(512 / Math.max(g.w, g.h))), W = g.w * z, H = g.h * z;
  const raw = new Uint8Array((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = g.ndvi[Math.floor(y / z) * g.w + Math.floor(x / z)], o = y * (W * 4 + 1) + 1 + x * 4;
    if (Number.isNaN(n)) continue;
    const [r, gg, b] = rampColor(n);
    raw[o] = r; raw[o + 1] = gg; raw[o + 2] = b; raw[o + 3] = 255;
  }
  const idat = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H); ihdr.set([8, 6, 0, 0, 0], 8);
  return concat([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array())]);
}

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); out.set([...type].map((c) => c.charCodeAt(0)), 4); out.set(data, 8);
  let c = 0xffffffff; for (let i = 4; i < 8 + data.length; i++) c = CRC[(c ^ out[i]) & 255] ^ (c >>> 8);
  dv.setUint32(8 + data.length, (c ^ 0xffffffff) >>> 0);
  return out;
}
const concat = (a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let p = 0; for (const x of a) { o.set(x, p); p += x.length; } return o; };
