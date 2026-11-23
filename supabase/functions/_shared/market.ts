// Pure helpers for AGMARKNET (data.gov.in) market prices and the harvest-time price outlook. Jest-testable.

export type PriceRow = {
  state: string; district: string; market: string; commodity: string; variety: string; grade: string;
  arrival_date: string; min_price: number | null; max_price: number | null; modal_price: number | null;
};

const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
/** "dd/mm/yyyy" or "yyyy-mm-dd" → "yyyy-mm-dd"; null when unparseable. */
export function isoDate(v: unknown): string | null {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** data.gov.in records use either lower_case or Title_Case field names depending on the dataset. */
export function parseRecord(r: Record<string, unknown>): PriceRow | null {
  const g = (k: string) => r[k] ?? r[k.charAt(0).toUpperCase() + k.slice(1)] ?? r[k.split('_').map((p) => p[0].toUpperCase() + p.slice(1)).join('_')];
  const row: PriceRow = {
    state: String(g('state') ?? '').trim(),
    district: String(g('district') ?? '').trim(),
    market: String(g('market') ?? '').trim(),
    commodity: String(g('commodity') ?? '').trim(),
    variety: String(g('variety') ?? '').trim(),
    grade: String(g('grade') ?? '').trim(),
    arrival_date: isoDate(g('arrival_date')) ?? '',
    min_price: num(g('min_price')), max_price: num(g('max_price')), modal_price: num(g('modal_price')),
  };
  if (!row.state || !row.market || !row.commodity || !row.arrival_date || row.modal_price == null || row.modal_price === 0) return null;
  // Reject obviously broken rows (₹/quintal): modal outside min..max by more than a rupee, or absurd values.
  if (row.min_price != null && row.max_price != null && (row.modal_price < row.min_price - 1 || row.modal_price > row.max_price + 1)) return null;
  if (row.modal_price > 2_000_000) return null;
  return row;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const r0 = (n: number) => Math.round(n);

export type MonthStat = { yr: number; mon: number; modal_avg: number };

/**
 * Harvest-time price outlook from seasonal history: for each past year that has prices both in the current
 * month and in the harvest month, take the ratio harvest/current and apply it to today's price.
 * Returns a low–mid–high band (min, median, max of those scenarios), never a single promised number.
 */
export function harvestOutlook(stats: MonthStat[], currentPrice: number, nowMonth: number, harvestMonth: number, thisYear: number) {
  const byYear = new Map<number, Map<number, number>>();
  for (const s of stats) {
    if (s.yr >= thisYear) continue;  // only completed past years
    if (!byYear.has(s.yr)) byYear.set(s.yr, new Map());
    byYear.get(s.yr)!.set(s.mon, s.modal_avg);
  }
  const scenarios: { year: number; ratio: number; price: number }[] = [];
  for (const [year, months] of byYear) {
    const from = months.get(nowMonth), to = months.get(harvestMonth);
    if (from && to) scenarios.push({ year, ratio: Math.round((to / from) * 1000) / 1000, price: r0(currentPrice * (to / from)) });
  }
  if (scenarios.length < 2) return { enough_history: false as const, years_used: scenarios.length, scenarios };
  const prices = scenarios.map((s) => s.price);
  const mid = median(prices)!;
  const low = Math.min(...prices), high = Math.max(...prices);
  // Spread relative to the middle tells the farmer how uncertain this is.
  const spreadPct = Math.round(((high - low) / mid) * 100);
  return {
    enough_history: true as const,
    years_used: scenarios.length,
    scenarios: scenarios.sort((a, b) => a.year - b.year),
    price_low: low, price_mid: r0(mid), price_high: high,
    uncertainty: spreadPct >= 30 || scenarios.length < 3 ? 'high' : spreadPct >= 15 ? 'medium' : 'low',
  };
}

/** Latest price per market + simple trend vs ~7 days earlier. Rows: newest first or any order. */
export function marketSummary(rows: PriceRow[]) {
  const byMarket = new Map<string, PriceRow[]>();
  for (const r of rows) {
    const k = `${r.state}|${r.district}|${r.market}`;
    byMarket.set(k, [...(byMarket.get(k) ?? []), r]);
  }
  return [...byMarket.values()].map((rs) => {
    rs.sort((a, b) => b.arrival_date.localeCompare(a.arrival_date));
    const latest = rs[0];
    const weekAgo = rs.find((r) => Date.parse(latest.arrival_date) - Date.parse(r.arrival_date) >= 6 * 86_400_000);
    return {
      state: latest.state, district: latest.district, market: latest.market, variety: latest.variety,
      arrival_date: latest.arrival_date, min_price: latest.min_price, max_price: latest.max_price, modal_price: latest.modal_price,
      change_7d: weekAgo?.modal_price ? r0(latest.modal_price! - weekAgo.modal_price) : null,
    };
  }).sort((a, b) => b.arrival_date.localeCompare(a.arrival_date) || (b.modal_price ?? 0) - (a.modal_price ?? 0));
}

/** One point per day: median modal price across markets (robust to one odd mandi). */
export function dailySeries(rows: PriceRow[]) {
  const byDay = new Map<string, number[]>();
  for (const r of rows) if (r.modal_price) byDay.set(r.arrival_date, [...(byDay.get(r.arrival_date) ?? []), r.modal_price]);
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, ps]) => ({
    date, modal: r0(median(ps)!), min: Math.min(...ps), max: Math.max(...ps), markets: ps.length,
  }));
}

// Common farm crop names → AGMARKNET commodity names (the farmer can still search any commodity).
// shortcut: names match today's AGMARKNET feed; older history rows use earlier spellings (e.g. 'Paddy(Dhan)(Common)'), so the outlook for renamed crops builds up from now.
export const CROP_TO_COMMODITY: Record<string, string> = {
  paddy: 'Paddy(Common)', rice: 'Rice', maize: 'Maize', corn: 'Maize', cotton: 'Cotton', chilli: 'Dry Chillies',
  chillies: 'Dry Chillies', turmeric: 'Turmeric', groundnut: 'Groundnut', tomato: 'Tomato', onion: 'Onion', potato: 'Potato',
  banana: 'Banana', wheat: 'Wheat', sugarcane: 'Sugarcane', 'red gram': 'Red gram/Arhar/Tur(whole)', tur: 'Red gram/Arhar/Tur(whole)',
  'black gram': 'Black Gram(Urd Beans)(Whole)', 'green gram': 'Green Gram(Moong)(Whole)', 'bengal gram': 'Bengal Gram(Gram)(Whole)',
  jowar: 'Jowar(Sorghum)', bajra: 'Bajra(Pearl Millet/Cumbu)', ragi: 'Ragi (Finger Millet)', soybean: 'Soyabean', sunflower: 'Sunflower',
  mango: 'Mango', brinjal: 'Brinjal', okra: 'Bhindi(Ladies Finger)', bhindi: 'Bhindi(Ladies Finger)', cabbage: 'Cabbage', cauliflower: 'Cauliflower',
  coconut: 'Coconut', cashew: 'Cashewnuts', mustard: 'Mustard', sesame: 'Sesamum(Sesame,Gingelly,Til)', coriander: 'Coriander(Leaves)',
};
export const commodityFor = (cropName: string) => CROP_TO_COMMODITY[cropName.trim().toLowerCase()] ?? null;
