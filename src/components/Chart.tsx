// Lightweight SVG charts (react-native-svg): line/area with optional min–max band and limit lines, and bars.
// Works the same on Android, web and the Windows app. Tap or drag to read a value.
import { memo, useMemo, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText, Circle } from 'react-native-svg';
import { AppText } from './AppText';
import { colors, fonts } from '@/theme';

export type Pt = { x: number; y: number; lo?: number; hi?: number };
export type Series = { points: Pt[]; color?: string; label?: string; dashed?: boolean };
export type Limit = { y: number; label?: string; color?: string };

type Props = {
  series: Series[];
  height?: number;
  unit?: string;
  limits?: Limit[];
  formatX?: (x: number) => string;
  formatY?: (y: number) => string;
  yMin?: number;
  yMax?: number;
  accessibilityLabel?: string;
};

const PAD = { l: 40, r: 12, t: 12, b: 22 };

/** "Nice" tick values covering [lo, hi]. */
export function ticks(lo: number, hi: number, n = 4) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [];
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

export const LineChart = memo(function LineChart({ series, height = 180, unit, limits = [], formatX, formatY = (y) => `${Math.round(y * 100) / 100}`, yMin, yMax, accessibilityLabel }: Props) {
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const all = useMemo(() => series.flatMap((s) => s.points), [series]);
  const g = useMemo(() => {
    if (!all.length || !w) return null;
    const xs = all.map((p) => p.x);
    const ys = [...all.flatMap((p) => [p.y, p.lo ?? p.y, p.hi ?? p.y]), ...limits.map((l) => l.y)];
    let lo = yMin ?? Math.min(...ys), hi = yMax ?? Math.max(...ys);
    const padY = (hi - lo || Math.abs(hi) || 1) * 0.08;
    if (yMin == null) lo -= padY;
    if (yMax == null) hi += padY;
    const x0 = Math.min(...xs), x1 = Math.max(...xs) === x0 ? x0 + 1 : Math.max(...xs);
    const sx = (x: number) => PAD.l + ((x - x0) / (x1 - x0)) * (w - PAD.l - PAD.r);
    const sy = (y: number) => PAD.t + (1 - (y - lo) / (hi - lo)) * (height - PAD.t - PAD.b);
    return { sx, sy, lo, hi, x0, x1 };
  }, [all, w, height, limits, yMin, yMax]);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const pick = (e: GestureResponderEvent) => {
    if (!g || !series[0]?.points.length) return;
    const x = e.nativeEvent.locationX;
    let best = 0, d = Infinity;
    series[0].points.forEach((p, i) => { const dd = Math.abs(g.sx(p.x) - x); if (dd < d) { d = dd; best = i; } });
    setSel(best);
  };
  const first = series[0]?.points;
  const picked = sel != null && first?.[sel];
  const summary = accessibilityLabel ?? (first?.length ? `${series[0].label ?? ''} ${formatY(Math.min(...first.map((p) => p.y)))}–${formatY(Math.max(...first.map((p) => p.y)))} ${unit ?? ''}` : '');

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={summary}
      onStartShouldSetResponder={() => true} onResponderGrant={pick} onResponderMove={pick} onResponderRelease={() => setTimeout(() => setSel(null), 2500)}>
      {g && (
        <Svg width={w} height={height}>
          {ticks(g.lo, g.hi).map((v) => (
            <G key={v}>
              <Line x1={PAD.l} x2={w - PAD.r} y1={g.sy(v)} y2={g.sy(v)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={PAD.l - 6} y={g.sy(v) + 4} fontSize={10} fill={colors.textSubtle} textAnchor="end" fontFamily={fonts.body}>{formatY(v)}</SvgText>
            </G>
          ))}
          {formatX && [g.x0, (g.x0 + g.x1) / 2, g.x1].map((x, i) => (
            <SvgText key={i} x={g.sx(x)} y={height - 6} fontSize={10} fill={colors.textSubtle} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontFamily={fonts.body}>{formatX(x)}</SvgText>
          ))}
          {limits.map((l, i) => (
            <G key={`l${i}`}>
              <Line x1={PAD.l} x2={w - PAD.r} y1={g.sy(l.y)} y2={g.sy(l.y)} stroke={l.color ?? colors.error} strokeWidth={1} strokeDasharray="4 4" />
              {l.label && <SvgText x={w - PAD.r} y={g.sy(l.y) - 3} fontSize={10} fill={l.color ?? colors.error} textAnchor="end" fontFamily={fonts.bodySemi}>{l.label}</SvgText>}
            </G>
          ))}
          {series.map((s, si) => {
            const c = s.color ?? colors.primary;
            const pts = s.points;
            if (!pts.length) return null;
            const line = pts.map((p, i) => `${i ? 'L' : 'M'}${g.sx(p.x).toFixed(1)},${g.sy(p.y).toFixed(1)}`).join('');
            const band = pts.some((p) => p.lo != null) ? pts.map((p, i) => `${i ? 'L' : 'M'}${g.sx(p.x).toFixed(1)},${g.sy(p.hi ?? p.y).toFixed(1)}`).join('') +
              [...pts].reverse().map((p) => `L${g.sx(p.x).toFixed(1)},${g.sy(p.lo ?? p.y).toFixed(1)}`).join('') + 'Z' : null;
            return (
              <G key={si}>
                {band && <Path d={band} fill={c} opacity={0.15} />}
                <Path d={line} stroke={c} strokeWidth={2} fill="none" strokeDasharray={s.dashed ? '6 4' : undefined} />
                {pts.length < 40 && pts.map((p, i) => <Circle key={i} cx={g.sx(p.x)} cy={g.sy(p.y)} r={2.5} fill={c} />)}
              </G>
            );
          })}
          {picked && (
            <G>
              <Line x1={g.sx(picked.x)} x2={g.sx(picked.x)} y1={PAD.t} y2={height - PAD.b} stroke={colors.textMuted} strokeWidth={1} />
              <Circle cx={g.sx(picked.x)} cy={g.sy(picked.y)} r={5} fill={series[0].color ?? colors.primary} stroke={colors.white} strokeWidth={2} />
            </G>
          )}
        </Svg>
      )}
      {picked ? (
        <AppText variant="labelMd" color={colors.textMuted} align="center">
          {formatX?.(picked.x)} · {series.map((s) => s.points[sel!] && `${s.label ? `${s.label} ` : ''}${formatY(s.points[sel!].y)}`).filter(Boolean).join(' · ')} {unit}
          {picked.lo != null && picked.hi != null ? ` (${formatY(picked.lo)}–${formatY(picked.hi)})` : ''}
        </AppText>
      ) : series.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {series.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 12, height: 3, backgroundColor: s.color ?? colors.primary }} />
              <AppText variant="labelSm" color={colors.textMuted}>{s.label}</AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

export type Bar = { label: string; value: number; color?: string };
export const BarChart = memo(function BarChart({ bars, height = 160, formatY = (y: number) => `${Math.round(y)}`, unit, accessibilityLabel }: { bars: Bar[]; height?: number; formatY?: (y: number) => string; unit?: string; accessibilityLabel?: string }) {
  const [w, setW] = useState(0);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const t = ticks(0, max);
  const top = t.at(-1) ?? max;
  const bw = bars.length ? (w - PAD.l - PAD.r) / bars.length : 0;
  const sy = (v: number) => PAD.t + (1 - v / top) * (height - PAD.t - PAD.b);
  const every = Math.ceil(bars.length / 8);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} accessible accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? bars.map((b) => `${b.label} ${formatY(b.value)} ${unit ?? ''}`).join(', ')}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {t.map((v) => (
            <G key={v}>
              <Line x1={PAD.l} x2={w - PAD.r} y1={sy(v)} y2={sy(v)} stroke={colors.border} />
              <SvgText x={PAD.l - 6} y={sy(v) + 4} fontSize={10} fill={colors.textSubtle} textAnchor="end" fontFamily={fonts.body}>{formatY(v)}</SvgText>
            </G>
          ))}
          {bars.map((b, i) => (
            <G key={i}>
              <Rect x={PAD.l + i * bw + bw * 0.15} y={sy(b.value)} width={bw * 0.7} height={Math.max(0, height - PAD.b - sy(b.value))} rx={3} fill={b.color ?? colors.primary} />
              {i % every === 0 && <SvgText x={PAD.l + i * bw + bw / 2} y={height - 6} fontSize={10} fill={colors.textSubtle} textAnchor="middle" fontFamily={fonts.body}>{b.label}</SvgText>}
            </G>
          ))}
        </Svg>
      )}
    </View>
  );
});
