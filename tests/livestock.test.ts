import { ageMonths, vaccState } from '@/features/livestock/vaccination';
import { animalSchema, ANIMAL_STATUS, HEALTH_TYPES, healthSchema, SPECIES, vaccinationSchema } from '@/features/livestock/schemas';
import en from '@/locales/en/translation.json';

const get = (k: string) => k.split('.').reduce<any>((a, p) => a?.[p], en);
const T = '2026-11-22';

describe('vaccState', () => {
  it.each([
    [{ status: 'completed', due_on: '2026-01-01' }, 'done'],
    [{ status: 'missed', due_on: null }, 'missed'],
    [{ status: 'scheduled', due_on: '2026-11-21' }, 'overdue'],
    [{ status: 'scheduled', due_on: '2026-11-22' }, 'due_soon'],
    [{ status: 'scheduled', due_on: '2026-11-29' }, 'due_soon'],
    [{ status: 'scheduled', due_on: '2026-11-30' }, 'scheduled'],
    [{ status: 'scheduled', due_on: null }, 'scheduled'],
  ] as const)('%o → %s', (v, s) => expect(vaccState(v, T)).toBe(s));
});

describe('ageMonths', () => {
  it('counts whole months, ignores future/unknown', () => {
    expect(ageMonths('2024-11-22', T)).toBe(24);
    expect(ageMonths('2024-11-23', T)).toBe(23);
    expect(ageMonths('2026-12-01', T)).toBeNull();
    expect(ageMonths(null, T)).toBeNull();
  });
});

describe('schemas', () => {
  const animal = { species: 'cow', tag_id: '', name: '', breed: '', sex: '', birth_date: '', weight_kg: '', status: 'healthy', notes: '' };
  it('animal needs a tag or a name', () => {
    expect(animalSchema.safeParse(animal).error?.issues[0].message).toBe('validation.tagOrName');
    expect(animalSchema.safeParse({ ...animal, name: 'Lakshmi' }).success).toBe(true);
    expect(animalSchema.safeParse({ ...animal, tag_id: 'AP-123', weight_kg: '-5' }).error?.issues[0].message).toBe('validation.number');
  });
  it('health follow-up after the record date', () => {
    const h = { record_type: 'illness', recorded_on: T, description: 'Fever', vet_name: '', follow_up_on: '2026-11-20' };
    expect(healthSchema.safeParse(h).error?.issues[0].message).toBe('validation.followUpAfter');
    expect(healthSchema.safeParse({ ...h, follow_up_on: '' }).success).toBe(true);
  });
  it('vaccination needs a name and a date', () => {
    expect(vaccinationSchema.safeParse({ vaccine_name: '', dose: '', given: false, date: T, notes: '' }).error?.issues[0].message).toBe('validation.required');
  });
});

it('every livestock enum has an English label', () => {
  const keys = [...SPECIES.map((s) => `livestock.species.${s}`), ...ANIMAL_STATUS.map((s) => `livestock.statuses.${s}`), ...HEALTH_TYPES.map((s) => `livestock.healthTypes.${s}`),
    ...['done', 'overdue', 'due_soon', 'scheduled', 'missed'].map((s) => `livestock.vacc.${s}`)];
  expect(keys.filter((k) => typeof get(k) !== 'string')).toEqual([]);
});
