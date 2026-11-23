// Shared server helpers for Level 2 functions: caller auth, service client, timed fetch, server cache.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { userClient } from './supabase.ts';

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
/** Service-role client: server-only tables (caches, device keys, readings from devices). Never sent to the app. */
export const admin: SupabaseClient | null = serviceKey
  ? createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } })
  : null;

/** The signed-in caller (JWT verified locally) and a client that acts as them under RLS. */
export async function caller(req: Request): Promise<{ sb: SupabaseClient; uid: string } | null> {
  const sb = userClient(req);
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data } = await sb.auth.getClaims(token);
  const uid = data?.claims?.sub;
  return uid ? { sb, uid } : null;
}

/** fetch with a hard timeout so a slow upstream never hangs the app. */
export async function timedFetch(url: string, init: RequestInit = {}, ms = 12_000): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

/** Read-through cache in weather_cache (server-only table). Returns { data, cached, fetched_at }. */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<{ data: T; cached: boolean; fetched_at: string }> {
  if (admin) {
    const { data: hit } = await admin.from('weather_cache').select('payload, fetched_at').eq('cache_key', key).maybeSingle();
    if (hit && Date.now() - Date.parse(hit.fetched_at) < ttlMs) return { data: hit.payload as T, cached: true, fetched_at: hit.fetched_at };
  }
  const data = await load();
  const fetched_at = new Date().toISOString();
  // Best effort: a cache write failure must not fail the request.
  if (admin) await admin.from('weather_cache').upsert({ cache_key: key, payload: data, fetched_at }).then(() => {}, () => {});
  return { data, cached: false, fetched_at };
}

export const isLatLon = (lat: unknown, lon: unknown): lat is number =>
  typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

/** Thrown for upstream problems; mapped to a translated error code by the caller. */
export class Upstream extends Error {}

export async function sha256(s: string) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
/** Server-only secret the simulator uses to call `ingest` for simulated devices. Never leaves the server. */
export const simSecret = async () => (serviceKey ? await sha256('sim:' + serviceKey) : '');

// data.gov.in refuses connections from outside India, and this project runs in ap-southeast-1.
// Re-send the request once to the Mumbai edge region; the x-region header stops it looping.
export async function viaIndia(req: Request, name: string): Promise<Response | null> {
  if (req.headers.get('x-region')) return null;
  const headers = new Headers(req.headers);
  headers.set('x-region', 'ap-south-1');
  for (const h of ['host', 'content-length', 'connection']) headers.delete(h);
  const r = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${name}`, { method: req.method, headers, body: req.method === 'POST' ? await req.arrayBuffer() : undefined });
  return new Response(r.body, { status: r.status, headers: r.headers });
}
