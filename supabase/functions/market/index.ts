// Agricultural price intelligence (no buying or selling — information only).
// POST { action: 'prices', commodity, state?, days? }        → mandi prices from AGMARKNET (data.gov.in), cached in market_prices
// POST { action: 'commodities', q? }                         → commodity names to search
// POST { action: 'outlook', commodity, state?, harvest_month, quantity_qtl?, crop_id?, language? }
//                                                            → harvest-time price range from past seasons + AI-listed factors
import { cors, fail, json } from '../_shared/http.ts';
import { admin, cached, caller, timedFetch, Upstream } from '../_shared/server.ts';
import { CROP_TO_COMMODITY, dailySeries, harvestOutlook, marketSummary, parseRecord, PriceRow } from '../_shared/market.ts';
import { FAST_MODELS, generateJson, languageName } from '../_shared/gemini.ts';

const API = 'https://api.data.gov.in/resource';
// Current daily prices (all mandis, today) and the variety-wise historical dataset. Overridable if data.gov.in changes them.
const CURRENT = Deno.env.get('MARKET_RESOURCE_CURRENT') ?? '9ef84268-d588-465a-a308-a864a43d0070';
const HISTORY = Deno.env.get('MARKET_RESOURCE_HISTORY') ?? '35985678-0d79-46b4-9ed6-6f13308a1d24';
const SOURCE = 'AGMARKNET (Directorate of Marketing & Inspection) via data.gov.in';
const text = (v: unknown, max = 80) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function pull(resource: string, filters: Record<string, string>, pages: number): Promise<PriceRow[]> {
  const key = Deno.env.get('DATA_GOV_IN_API_KEY')!;
  const out: PriceRow[] = [];
  for (let page = 0; page < pages; page++) {
    const p = new URLSearchParams({ 'api-key': key, format: 'json', limit: '1000', offset: String(page * 1000) });
    for (const [k, v] of Object.entries(filters)) p.set(`filters[${k}]`, v);
    const r = await timedFetch(`${API}/${resource}?${p}`, {}, 20_000);
    if (r.status === 401 || r.status === 403) throw new Upstream('market_key_invalid');
    if (!r.ok) throw new Upstream(`data.gov.in ${r.status}`);
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
async function refresh(commodity: string, state: string) {
  const f: Record<string, string> = { commodity, ...(state ? { state } : {}) };
  await cached(`mkt:cur:${commodity}:${state}`, 3 * 3600_000, async () => { const rows = await pull(CURRENT, f, 3); await store(rows); return { n: rows.length }; });
  await cached(`mkt:hist:${commodity}:${state}`, 7 * 86_400_000, async () => {
    const rows = await pull(HISTORY, { Commodity: commodity, ...(state ? { State: state } : {}) }, 5).catch((e) => { console.warn('history', String(e)); return []; });
    await store(rows);
    return { n: rows.length };
  });
}

const factorsSchema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    increase_factors: { type: 'ARRAY', items: { type: 'STRING' } },
    decrease_factors: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['summary', 'increase_factors', 'decrease_factors'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const who = await caller(req);
  if (!who) return fail('unauthorized', 401);
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return fail('bad_request'); }
  const configured = !!Deno.env.get('DATA_GOV_IN_API_KEY');
  const commodity = text(b.commodity), state = text(b.state, 40);

  try {
    if (b.action === 'commodities') {
      const q = text(b.q, 40).toLowerCase();
      const { data } = await who.sb.from('market_prices').select('commodity').ilike('commodity', `%${q.replace(/[%_]/g, '')}%`).limit(500);
      const names = new Set<string>([...(data ?? []).map((r) => r.commodity), ...Object.values(CROP_TO_COMMODITY).filter((c) => c.toLowerCase().includes(q))]);
      return json({ configured, commodities: [...names].sort().slice(0, 40) });
    }

    if (!commodity) return fail('bad_request');
    let warning: string | null = null;
    if (configured) await refresh(commodity, state).catch((e) => { warning = e instanceof Error && e.message === 'market_key_invalid' ? 'market_key_invalid' : 'market_refresh_failed'; console.warn('refresh', String(e)); });

    if (b.action === 'prices') {
      const days = Math.min(365, Math.max(7, Number(b.days) || 30));
      const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
      let q = who.sb.from('market_prices').select('state,district,market,commodity,variety,grade,arrival_date,min_price,max_price,modal_price,fetched_at')
        .eq('commodity', commodity).gte('arrival_date', since).order('arrival_date', { ascending: false }).limit(5000);
      if (state) q = q.eq('state', state);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as (PriceRow & { fetched_at: string })[];
      return json({
        configured, warning, source: SOURCE, commodity, state: state || null, unit: '₹/quintal',
        last_updated: rows.reduce<string | null>((m, r) => (!m || r.fetched_at > m ? r.fetched_at : m), null),
        markets: marketSummary(rows), series: dailySeries(rows),
      });
    }

    if (b.action === 'outlook') {
      const harvestMonth = Number(b.harvest_month);
      if (!(harvestMonth >= 1 && harvestMonth <= 12)) return fail('bad_request');
      const language = ['en', 'te', 'hi'].includes(b.language as string) ? (b.language as string) : 'en';
      const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
      let cq = who.sb.from('market_prices').select('modal_price').eq('commodity', commodity).gte('arrival_date', since);
      if (state) cq = cq.eq('state', state);
      const [{ data: recent }, { data: stats, error }] = await Promise.all([cq, who.sb.rpc('seasonal_prices', { p_commodity: commodity, p_state: state || null })]);
      if (error) throw error;
      const ps = (recent ?? []).map((r) => Number(r.modal_price)).sort((a, c) => a - c);
      if (!ps.length) return json({ configured, warning, enough_history: false, reason: 'no_current_price' });
      const current = ps[Math.floor(ps.length / 2)];
      const now = new Date();
      const o = harvestOutlook((stats ?? []).map((s: { yr: number; mon: number; modal_avg: number }) => ({ yr: s.yr, mon: s.mon, modal_avg: Number(s.modal_avg) })), current, now.getUTCMonth() + 1, harvestMonth, now.getUTCFullYear());
      const qty = Number(b.quantity_qtl);
      const revenue = o.enough_history && qty > 0 && qty < 1e6
        ? { quantity_qtl: qty, low: Math.round(qty * o.price_low), mid: Math.round(qty * o.price_mid), high: Math.round(qty * o.price_high) } : null;

      // AI lists possible price drivers in words only; every number above comes from recorded prices.
      let factors: { summary: string; increase_factors: string[]; decrease_factors: string[] } | null = null;
      if (o.enough_history) {
        factors = await generateJson<typeof factors>({
          system: `You explain agricultural market prices to Indian farmers in ${languageName(language)}. Use ONLY the numbers given. ` +
            'Do not invent prices, percentages, dates or news. List general, well-known reasons prices of this commodity can rise or fall around harvest ' +
            '(arrivals, MSP/procurement, storage, weather, demand, exports) as possibilities, not predictions. Max 4 short items each. ' +
            'The summary (max 2 sentences) must say this is an estimate from past seasons and prices can move outside the range.',
          parts: [{ text: JSON.stringify({ commodity, state: state || 'all India', current_price_per_quintal: current, harvest_month: harvestMonth, range: [o.price_low, o.price_mid, o.price_high], years_of_history: o.years_used, uncertainty: o.uncertainty }) }],
          schema: factorsSchema, temperature: 0.2, maxOutputTokens: 600, models: FAST_MODELS, thinking: 'minimal',
        }).catch(() => null);
      }
      if (o.enough_history) {
        const cropId = typeof b.crop_id === 'string' ? b.crop_id : null;
        await who.sb.from('harvest_forecasts').insert({
          owner_id: who.uid, crop_id: cropId, commodity, price_low: o.price_low, price_mid: o.price_mid, price_high: o.price_high,
          method: 'historical_seasonal', basis: { current_price: current, harvest_month: harvestMonth, state: state || null, years_used: o.years_used, scenarios: o.scenarios, uncertainty: o.uncertainty },
        }).then(({ error: e }) => e && console.warn('forecast save', e.message));
      }
      return json({ configured, warning, source: SOURCE, commodity, current_price: current, harvest_month: harvestMonth, ...o, revenue, factors, ai_factors: !!factors });
    }
    return fail('bad_request');
  } catch (e) {
    console.error('market', String(e));
    return fail('market_unavailable', 502);
  }
});
