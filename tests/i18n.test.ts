import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import en from '@/locales/en/translation.json';
import te from '@/locales/te/translation.json';
import hi from '@/locales/hi/translation.json';

const keys = (o: object, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
const vars = (s: string) => (s.match(/{{\w+}}/g) ?? []).sort().join();
const get = (o: any, k: string) => k.split('.').reduce((a, p) => a?.[p], o);

describe.each([['te', te], ['hi', hi]])('%s translation', (_code, dict) => {
  it('has exactly the English keys', () => expect(keys(dict).sort()).toEqual(keys(en).sort()));
  it('keeps interpolation variables', () => keys(en).forEach((k) => expect([k, vars(get(dict, k))]).toEqual([k, vars(get(en, k))])));
  it('is actually translated (not English copies)', () => {
    const same = keys(en).filter((k) => get(dict, k) === get(en, k) && /[a-z]{4,}/i.test(get(en, k)) && !/@|AgriAqua|English|SMS|AI/.test(get(en, k)));
    expect(same).toEqual([]);
  });
});

// Every literal t('...') key used in the app must exist in English.
it('all t() keys used in src exist', () => {
  const files: string[] = [];
  const walk = (d: string) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : /\.tsx?$/.test(e.name) && files.push(join(d, e.name))));
  walk(join(__dirname, '../src'));
  const used = new Set<string>();
  for (const f of files) for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z]+\.[a-zA-Z.]+)'/g)) used.add(m[1]);
  const all = new Set(keys(en));
  expect([...used].filter((k) => !all.has(k) && !all.has(`${k}_other`))).toEqual([]); // plural keys live as k_one / k_other
});
