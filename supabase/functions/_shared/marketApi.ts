// AGMARKNET (data.gov.in) download + store, shared by `market` (on demand) and `cron` (daily sync).
import { admin, cached, timedFetch, Upstream } from './server.ts';
import { parseRecord, PriceRow } from './market.ts';

const API = 'https://api.data.gov.in/resource';
// Current daily prices (all mandis, today) and the variety-wise historical dataset. Overridable if data.gov.in changes them.
const CURRENT = Deno.env.get('MARKET_RESOURCE_CURRENT') ?? '9ef84268-d588-465a-a308-a864a43d0070';
const HISTORY = Deno.env.get('MARKET_RESOURCE_HISTORY') ?? '35985678-0d79-46b4-9ed6-6f13308a1d24';
export const SOURCE = 'AGMARKNET (Directorate of Marketing & Inspection) via data.gov.in';

async function pull(resource: string, filters: Record<string, string>, pages: number): Promise<PriceRow[]> {
  const key = Deno.env.get('DATA_GOV_IN_API_KEY')!;
  const out: PriceRow[] = [];
  for (let page = 0; page < pages; page++) {
    const p = new URLSearchParams({ 'api-key': key, format: 'json', limit: '1000', offset: String(page * 1000) });
    for (const [k, v] of Object.entries(filters)) p.set(`filters[${k}]`, v);
    const r = await timedFetch(`${API}/${resource}?${p}`, {}, 20_000);
    if (r.status === 401 || r.status === 403) throw new Upstream('market_key_invalid');
    if (!r.ok) throw new Upstream(`data.gov.in ${r.status} ${(await r.text()).slice(0, 200)}`);
    const body = await r.json();
    const recs: Record<string, unknown>[] = body.records ?? [];
    recs.forEach((x) => { const row = parseRecord(x); if (row) out.push(row); });
    if (recs.length < 1000) break;
  }
  return out;
}

async function store(rows: PriceRow[]) {
  if (!admin || !rows.length) return;
  // Same mandi/commodity/variety/grade/day → keep the latest copy.
  const uniq = new Map(rows.map((r) => [`${r.state}|${r.district}|${r.market}|${r.commodity}|${r.variety}|${r.grade}|${r.arrival_date}`, r]));
  const { error } = await admin.from('market_prices').upsert([...uniq.values()].map((r) => ({ ...r, fetched_at: new Date().toISOString() })),
    { onConflict: 'state,district,market,commodity,variety,grade,arrival_date' });
  if (error) console.error('market store', error.message);
}

/** Pull today's prices (every 3 h) and, once a week, past prices for this commodity/state. */
export async function refresh(commodity: string, state: string) {
  const f: Record<string, string> = { commodity, ...(state ? { state } : {}) };
  await cached(`mkt:cur:${commodity}:${state}`, 3 * 3600_000, async () => { const rows = await pull(CURRENT, f, 3); await store(rows); return { n: rows.length }; });
  await cached(`mkt:hist:${commodity}:${state}`, 7 * 86_400_000, async () => {
    const rows = await pull(HISTORY, { Commodity: commodity, ...(state ? { State: state } : {}) }, 5).catch((e) => { console.warn('history', String(e)); return []; });
    await store(rows);
    return { n: rows.length };
  });
}

