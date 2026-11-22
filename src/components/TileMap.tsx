// Minimal slippy map: OpenStreetMap tiles + SVG overlay (polygons, markers). No API key; works on Android, web, Windows.
// Drag to pan, +/- to zoom, tap to report a coordinate (used to draw farm boundaries and geofences).
import { useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Polygon, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, radius, fonts } from '@/theme';

const TILE = 256;
export type LonLat = [number, number];
export type MapPolygon = { points: LonLat[]; color?: string; fill?: string };
export type MapMarker = { lat: number; lon: number; color?: string; label?: string };

// Web Mercator ↔ world pixel at zoom z.
export const project = (lon: number, lat: number, z: number) => {
  const s = TILE * 2 ** z, r = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * s, y: (0.5 - Math.log((1 + r) / (1 - r)) / (4 * Math.PI)) * s };
};
export const unproject = (x: number, y: number, z: number) => {
  const s = TILE * 2 ** z;
  const lon = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  return { lon, lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) };
};
/** Zoom level that fits all points into a box of w×h pixels (clamped 3..18). */
export function fitZoom(points: LonLat[], w: number, h: number) {
  if (points.length < 2) return 16;
  for (let z = 18; z > 3; z--) {
    const ps = points.map(([lon, lat]) => project(lon, lat, z));
    const dx = Math.max(...ps.map((p) => p.x)) - Math.min(...ps.map((p) => p.x));
    const dy = Math.max(...ps.map((p) => p.y)) - Math.min(...ps.map((p) => p.y));
    if (dx < w * 0.8 && dy < h * 0.8) return z;
  }
  return 3;
}
export const centroid = (points: LonLat[]) => ({ lon: points.reduce((s, p) => s + p[0], 0) / points.length, lat: points.reduce((s, p) => s + p[1], 0) / points.length });

type Props = {
  center: { lat: number; lon: number };
  zoom?: number;
  height?: number;
  polygons?: MapPolygon[];
  markers?: MapMarker[];
  onPress?: (p: { lat: number; lon: number }) => void;
  accessibilityLabel?: string;
};

export function TileMap({ center, zoom: z0 = 15, height = 260, polygons = [], markers = [], onPress, accessibilityLabel }: Props) {
  const { t } = useTranslation();
  const [w, setW] = useState(0);
  const [zoom, setZoom] = useState(z0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });   // pan in pixels
  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
  const c = useMemo(() => { const p = project(center.lon, center.lat, zoom); return { x: p.x - offset.x, y: p.y - offset.y }; }, [center.lat, center.lon, zoom, offset]);
  const left = c.x - w / 2, top = c.y - height / 2;
  const n = 2 ** zoom;
  const tiles: { x: number; y: number; key: string }[] = [];
  if (w) for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++)
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++)
      if (ty >= 0 && ty < n) tiles.push({ x: tx, y: ty, key: `${zoom}/${((tx % n) + n) % n}/${ty}` });
  const toScreen = (lon: number, lat: number) => { const p = project(lon, lat, zoom); return { x: p.x - left, y: p.y - top }; };

  const start = (e: GestureResponderEvent) => { drag.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, ox: offset.x, oy: offset.y, moved: false }; };
  const move = (e: GestureResponderEvent) => {
    const d = drag.current; if (!d) return;
    const dx = e.nativeEvent.pageX - d.x, dy = e.nativeEvent.pageY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) d.moved = true;
    if (d.moved) setOffset({ x: d.ox + dx, y: d.oy + dy });
  };
  const end = (e: GestureResponderEvent) => {
    const d = drag.current; drag.current = null;
    if (d && !d.moved && onPress) { const p = unproject(left + e.nativeEvent.locationX, top + e.nativeEvent.locationY, zoom); onPress({ lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6 }); }
  };
  const zoomBy = (dz: number) => { const nz = Math.max(3, Math.min(19, zoom + dz)); setOffset({ x: offset.x * 2 ** (nz - zoom), y: offset.y * 2 ** (nz - zoom) }); setZoom(nz); };

  return (
    <View style={{ height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceHigh }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}
      accessible accessibilityLabel={accessibilityLabel ?? t('map.label')}>
      <View style={{ flex: 1 }} onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true} onResponderGrant={start} onResponderMove={move} onResponderRelease={end}>
        {tiles.map((tl) => (
          <Image key={tl.key} recyclingKey={tl.key} cachePolicy="disk" transition={0}
            source={{ uri: `https://tile.openstreetmap.org/${tl.key}.png`, headers: { 'User-Agent': 'AgriAqua360/2.0 (Android)' } }}
            style={{ position: 'absolute', left: tl.x * TILE - left, top: tl.y * TILE - top, width: TILE, height: TILE }} />
        ))}
        {w > 0 && (
          <Svg width={w} height={height} style={{ position: 'absolute' }} pointerEvents="none">
            {polygons.map((pg, i) => (
              <Polygon key={i} points={pg.points.map(([lon, lat]) => { const p = toScreen(lon, lat); return `${p.x},${p.y}`; }).join(' ')}
                fill={pg.fill ?? 'rgba(23,107,69,0.18)'} stroke={pg.color ?? colors.primary} strokeWidth={2} />
            ))}
            {polygons.flatMap((pg, i) => pg.points.length < 3 ? pg.points.map(([lon, lat], j) => { const p = toScreen(lon, lat); return <Circle key={`v${i}-${j}`} cx={p.x} cy={p.y} r={5} fill={pg.color ?? colors.primary} />; }) : [])}
            {markers.map((m, i) => { const p = toScreen(m.lon, m.lat); return (
              <Circle key={`m${i}`} cx={p.x} cy={p.y} r={7} fill={m.color ?? colors.water} stroke={colors.white} strokeWidth={2} />
            ); })}
            {markers.map((m, i) => { const p = toScreen(m.lon, m.lat); return m.label ? (
              <SvgText key={`t${i}`} x={p.x + 10} y={p.y + 4} fontSize={11} fontFamily={fonts.bodySemi} fill={colors.text}>{m.label}</SvgText>
            ) : null; })}
          </Svg>
        )}
      </View>
      <View style={{ position: 'absolute', right: 8, top: 8, gap: 6 }}>
        {[['add', 1], ['remove', -1]].map(([icon, dz]) => (
          <Pressable key={icon as string} onPress={() => zoomBy(dz as number)} accessibilityRole="button" accessibilityLabel={t(dz === 1 ? 'map.zoomIn' : 'map.zoomOut')}
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon as 'add'} size={20} />
          </Pressable>
        ))}
      </View>
      <View style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.8)', paddingHorizontal: 4 }}>
        <AppText variant="labelSm" color={colors.textMuted}>© OpenStreetMap</AppText>
      </View>
    </View>
  );
}

/** Polygon area in hectares (equirectangular, fine for farm-sized shapes). */
export function areaHa(points: LonLat[]) {
  if (points.length < 3) return 0;
  const lat0 = (points.reduce((s, p) => s + p[1], 0) / points.length) * (Math.PI / 180), k = 111_320;
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i], [x2, y2] = points[(i + 1) % points.length];
    a += x1 * Math.cos(lat0) * k * (y2 * k) - x2 * Math.cos(lat0) * k * (y1 * k);
  }
  return Math.abs(a) / 2 / 10_000;
}
