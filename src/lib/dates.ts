// Local-calendar date helpers. Dates are stored as 'YYYY-MM-DD' (Postgres date).
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => isoDate(new Date());
export const addDays = (s: string, n: number) => { const d = parseDate(s); d.setDate(d.getDate() + n); return isoDate(d); };
export const daysBetween = (a: string, b: string) => Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000);

const LOCALE = { en: 'en-IN', te: 'te-IN', hi: 'hi-IN' } as const;
export const formatDate = (s: string, lang: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  parseDate(s).toLocaleDateString(LOCALE[lang as keyof typeof LOCALE] ?? 'en-IN', opts);
/** Timestamp (ms or ISO) in the app language, e.g. chart axes: formatStamp(x, 'te', { hour: 'numeric' }). */
export const formatStamp = (t: number | string, lang: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) =>
  new Date(t).toLocaleString(LOCALE[lang as keyof typeof LOCALE] ?? 'en-IN', opts);
/** Axis label for a chart spanning `hours`: time of day for ≤ 1 day, date otherwise. */
export const axisFormat = (hours: number, lang: string) => (x: number) =>
  formatStamp(x, lang, hours <= 24 ? { hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short' });
