// Pure livestock analytics (unit-tested). Outputs are estimates; the UI says so.

/** Recent (last `recentHours`) average vs the baseline before it; change in % and a flag. */
export function anomaly(points: { x: number; y: number }[], recentHours = 24, now = Date.now()) {
  const cut = now - recentHours * 3600_000;
  const recent = points.filter((p) => p.x >= cut), base = points.filter((p) => p.x < cut);
  if (recent.length < 3 || base.length < 6) return null;
  const avg = (xs: { y: number }[]) => xs.reduce((s, p) => s + p.y, 0) / xs.length;
  const r = avg(recent), b = avg(base);
  if (!b) return null;
  const change = Math.round(((r - b) / b) * 100);
  return { recent: Math.round(r * 10) / 10, baseline: Math.round(b * 10) / 10, change, flag: change <= -30 ? 'drop' as const : change >= 50 ? 'rise' as const : null };
}

/** Daily milk totals → average, trend per day and 7-day projection (least squares). */
export function milkTrend(daily: { date: string; litres: number }[]) {
  if (daily.length < 3) return null;
  const xs = daily.map((_, i) => i), ys = daily.map((d) => d.litres), n = xs.length;
  const mx = (n - 1) / 2, my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const r1 = (v: number) => Math.round(v * 10) / 10;
  return { avg: r1(my), perDay: Math.round(slope * 100) / 100, next7: r1(Math.max(0, (my + slope * (n - 1 - mx + 3.5)) * 7)) };
}

/** Feed (kg) per litre of milk over the same period — lower is more efficient. */
export const feedPerLitre = (feedKg: number, milkL: number) => (feedKg > 0 && milkL > 0 ? Math.round((feedKg / milkL) * 100) / 100 : null);
