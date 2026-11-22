import { adviceKey, level, overall, rangeLabel } from '@/features/aquaculture/waterQuality';

describe('water quality levels', () => {
  it.each([
    ['ph', 7.8, 'ok'], ['ph', 6.8, 'warn'], ['ph', 9.5, 'bad'], ['ph', 7.0, 'ok'],
    ['dissolved_oxygen_mgl', 6.2, 'ok'], ['dissolved_oxygen_mgl', 4, 'warn'], ['dissolved_oxygen_mgl', 2.5, 'bad'],
    ['temperature_c', 29, 'ok'], ['temperature_c', 33, 'warn'], ['temperature_c', 36, 'bad'],
    ['ammonia_mgl', 0.05, 'ok'], ['ammonia_mgl', 0.8, 'warn'], ['ammonia_mgl', 1.5, 'bad'],
    ['turbidity_cm', 35, 'ok'], ['turbidity_cm', 15, 'bad'],
  ] as const)('%s=%s → %s', (p, v, expected) => expect(level(p, v)).toBe(expected));

  it('does not judge salinity or missing values', () => {
    expect(level('salinity_ppt', 12)).toBeNull();
    expect(level('ph', null)).toBeNull();
  });

  it('overall takes the worst judged parameter', () => {
    expect(overall({ ph: 7.8, dissolved_oxygen_mgl: 2.5 })).toBe('bad');
    expect(overall({ ph: 6.8, temperature_c: 29 })).toBe('warn');
    expect(overall({ salinity_ppt: 15 })).toBeNull();
  });

  it('advice keys point low/high', () => {
    expect(adviceKey('dissolved_oxygen_mgl', 3)).toBe('water.advice.dissolved_oxygen_mgl_low');
    expect(adviceKey('ammonia_mgl', 0.9)).toBe('water.advice.ammonia_mgl_high');
    expect(adviceKey('ph', 7.5)).toBeNull();
  });

  it('range labels', () => {
    expect(rangeLabel('dissolved_oxygen_mgl')).toBe('> 5');
    expect(rangeLabel('ammonia_mgl')).toBe('< 0.5');
    expect(rangeLabel('ph')).toBe('7 – 8.5');
  });
});

import { FISH_RECORD_TYPES, POND_STATUS, readingSchema, SPECIES } from '@/features/aquaculture/schemas';
import { PARAMS, RANGES } from '@/features/aquaculture/waterQuality';
import en from '@/locales/en/translation.json';

const get = (k: string) => k.split('.').reduce<any>((a, p) => a?.[p], en);
const blank = { pond_id: 'p1', ph: '', dissolved_oxygen_mgl: '', temperature_c: '', ammonia_mgl: '', salinity_ppt: '', turbidity_cm: '', notes: '' };

describe('reading form', () => {
  it('needs a pond and at least one value', () => {
    expect(readingSchema.safeParse(blank).error?.issues[0].message).toBe('water.needOne');
    expect(readingSchema.safeParse({ ...blank, pond_id: '', ph: '7' }).error?.issues[0].message).toBe('validation.selectPond');
    expect(readingSchema.safeParse({ ...blank, ph: '7.5' }).success).toBe(true);
  });
  it('rejects impossible values', () => {
    expect(readingSchema.safeParse({ ...blank, ph: '15' }).error?.issues[0].message).toBe('validation.number');
    expect(readingSchema.safeParse({ ...blank, temperature_c: '-3' }).success).toBe(false);
  });
});

it('every advice, param, status and enum has an English label', () => {
  const keys = [
    ...(Object.keys(RANGES) as (keyof typeof RANGES)[]).flatMap((p) => [`water.advice.${p}_low`, `water.advice.${p}_high`]),
    ...PARAMS.map((p) => `water.params.${p.key}`), ...['ok', 'warn', 'bad'].map((l) => `water.status.${l}`),
    ...POND_STATUS.map((s) => `ponds.statuses.${s}`), ...SPECIES.map((s) => `ponds.speciesList.${s}`), ...FISH_RECORD_TYPES.map((s) => `ponds.types.${s}`),
  ];
  expect(keys.filter((k) => typeof get(k) !== 'string')).toEqual([]);
});
