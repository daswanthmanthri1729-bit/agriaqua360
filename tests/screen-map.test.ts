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

// Every screen must be reachable: some other file in src links to its route.
it('every mapped route is linked from the app', () => {
  const files: string[] = [];
  const walk = (d: string) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : /\.tsx?$/.test(e.name) && files.push(join(d, e.name))));
  walk(join(__dirname, '../src'));
  const { readFileSync } = jest.requireActual('fs');
  const src = files.map((f) => readFileSync(f, 'utf8')).join('\n');
  const tabs = ['/home', '/monitor', '/assistant', '/insights'];
  const unlinked = Object.entries(map).filter(([k]) => !k.startsWith('_')).map(([, r]) => r as string)
    .filter((r) => !tabs.includes(r) && !src.includes(`'${r.replace(/\/\[id\].*$/, '/')}`) && !src.includes(`\`${r.replace(/\/\[id\].*$/, '/')}`) && !src.includes(`'${r}'`));
  expect(unlinked).toEqual([]);
});
