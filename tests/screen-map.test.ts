import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import map from '../documentation/screen-map.json';

// /monitor → src/app/monitor.tsx | src/app/monitor/index.tsx | src/app/(tabs)/monitor.tsx
const routeFile = (route: string) => {
  const r = route === '/' ? 'index' : route.slice(1);
  return [`${r}.tsx`, `${r}/index.tsx`, `(tabs)/${r}.tsx`].map((f) => join(__dirname, '../src/app', f)).find(existsSync);
};

it('maps all 80 Level 2 designs to a route', () => {
  const designs = Object.keys(map).filter((k) => !k.startsWith('_'));
  expect(designs).toHaveLength(80);
  const ref = join(__dirname, '../design_reference/level2');   // local only (gitignored)
  if (existsSync(ref)) {
    const folders = readdirSync(ref).filter((d) => d.startsWith('agriaqua_360_')).map((d) => d.slice('agriaqua_360_'.length));
    expect(folders.filter((f) => !designs.includes(f))).toEqual([]);
  }
});

it('every mapped route has a screen', () => {
  const missing = Object.entries(map).filter(([k]) => !k.startsWith('_')).filter(([, r]) => !routeFile(r as string)).map(([k, r]) => `${k} → ${r}`);
  expect(missing).toEqual([]);
});
