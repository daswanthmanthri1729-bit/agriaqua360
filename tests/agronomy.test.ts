import { irrigationAdvice, kc, ndviClass, rateEc, rateNutrient, ratePh } from '@/features/intel/agronomy';
import { eligibility } from '@/features/intel/schemes';
import { ticks } from '@/components/Chart';
import { areaHa, fitZoom, project, unproject } from '@/components/TileMap';
import { deviceStatus } from '@/features/iot/api';
import type { Scheme } from '@/types/database';

describe('soil ratings (Soil Health Card norms)', () => {
  it('rates N/P/K/OC, pH and EC', () => {
    expect(rateNutrient('n', 240)).toBe('low');
    expect(rateNutrient('n', 400)).toBe('medium');
    expect(rateNutrient('k', 300)).toBe('high');
    expect(rateNutrient('oc', 0.6)).toBe('medium');
    expect(rateNutrient('p', null)).toBeNull();
    expect(ratePh(6.8)).toBe('neutral');
    expect(ratePh(8.2)).toBe('alkaline');
    expect(rateEc(3.5)).toBe('harmful');
  });
});

describe('irrigation advice (FAO-56)', () => {
  const base = { crop: 'Paddy', stage: 'flowering' as const, et0: [5, 5, 5, 5], rain: [0, 0, 0, 0], areaAcres: 1 };
  it('uses crop Kc and converts mm to litres', () => {
    const a = irrigationAdvice(base);
    expect(a.kc).toBe(1.2);
    expect(a.need_mm).toBe(18);
    expect(a.decision).toBe('irrigate_today');
    expect(a.litres).toBe(Math.round(18 * 4046.86));
    expect(a.reasons).toContain('irrigation.why.noSensor');
  });
  it('waits for real rain and ignores drizzle', () => {
    expect(irrigationAdvice({ ...base, rain: [12, 3, 0, 0] }).decision).toBe('wait_rain');
    expect(irrigationAdvice({ ...base, rain: [2, 2, 2, 0] }).effective_rain_mm).toBe(0);
  });
  it('a live soil-moisture sensor overrides the estimate', () => {
    expect(irrigationAdvice({ ...base, soilMoisturePct: 45 }).decision).toBe('not_needed');
    expect(irrigationAdvice({ ...base, et0: [1, 1, 1], soilMoisturePct: 18 }).decision).toBe('irrigate_today');
  });
  it('falls back to generic Kc for unknown crops', () => {
    expect(kc('Dragon fruit', 'vegetative')).toBe(0.75);
    expect(ndviClass(0.72)).toBe('dense');
    expect(ndviClass(0.15)).toBe('bare');
  });
});

describe('schemes eligibility hint', () => {
  const s = (rules: Scheme['rules'], sectors = ['agriculture']) => ({ code: 'x', level: 'central', state: null, sectors, name: {}, summary: {}, rules, official_url: 'https://x', info_as_of: '2026-06-01' }) as Scheme;
  const ctx = { hasLand: true, hasCrop: false, species: ['cow'], sectors: ['agriculture', 'livestock'] };
  it('explains what to check', () => {
    expect(eligibility(s({ requires_land: true }), ctx).level).toBe('likely');
    expect(eligibility(s({ crop_required: true }), ctx).reason).toBe('schemes.why.crop');
    expect(eligibility(s({ species: ['buffalo'] }, ['livestock']), ctx).reason).toBe('schemes.why.species');
    expect(eligibility(s({}, ['aquaculture']), ctx).reason).toBe('schemes.why.sector');
  });
});

describe('chart + map maths', () => {
  it('nice ticks', () => {
    expect(ticks(0, 9.3)).toEqual([0, 2.5, 5, 7.5]);
    expect(ticks(2080, 2310)).toEqual([2100, 2200, 2300]);
  });
  it('mercator round trip, area and zoom', () => {
    const p = project(80.2, 16.5, 15);
    const back = unproject(p.x, p.y, 15);
    expect(back.lon).toBeCloseTo(80.2, 6);
    expect(back.lat).toBeCloseTo(16.5, 6);
    // ~100 m × 100 m square ≈ 1 ha
    const sq: [number, number][] = [[80.2, 16.5], [80.200937, 16.5], [80.200937, 16.500899], [80.2, 16.500899]];
    expect(areaHa(sq)).toBeCloseTo(1, 1);
    expect(fitZoom(sq, 360, 260)).toBeGreaterThanOrEqual(16);
  });
  it('device online status', () => {
    const now = Date.parse('2026-11-22T10:00:00Z');
    expect(deviceStatus({ last_seen_at: '2026-11-22T09:50:00Z', reporting_interval_s: 300, is_simulated: false }, now)).toBe('online');
    expect(deviceStatus({ last_seen_at: '2026-11-22T09:00:00Z', reporting_interval_s: 300, is_simulated: false }, now)).toBe('offline');
    expect(deviceStatus({ last_seen_at: null, reporting_interval_s: 300, is_simulated: false }, now)).toBe('never');
  });
});

import { pondImpact, sprayWindow } from '@/features/intel/agronomy';
describe('weather advice', () => {
  const h = (hr: number, pop = 0, wind = 5) => ({ time: `2026-11-23T${String(hr).padStart(2, '0')}:00`, pop, rain_mm: 0, wind_kmh: wind });
  it('finds a 3-hour dry calm daytime window', () => {
    expect(sprayWindow([h(5), h(6), h(7, 40), h(8), h(9), h(10), h(11)])).toEqual({ from: '2026-11-23T08:00', to: '2026-11-23T11:00' });
    expect(sprayWindow([h(9), h(10, 0, 25), h(11), h(12)])).toBeNull();
    expect(sprayWindow([h(20), h(21), h(22), h(23)])).toBeNull();
  });
  it('flags pond oxygen risks', () => {
    expect(pondImpact([{ date: 'd1', max: 31, rain_mm: 2 }, { date: 'd2', max: 35, rain_mm: 0 }])).toEqual({ kind: 'heat', date: 'd2' });
    expect(pondImpact([{ date: 'd1', max: 30, rain_mm: 25 }])?.kind).toBe('cloudy_rain');
    expect(pondImpact([{ date: 'd1', max: 30, rain_mm: 0 }])).toBeNull();
  });
});

import { calibrationDue, signal } from '@/features/iot/api';
it('signal quality and calibration due', () => {
  expect([signal(-60), signal(-75), signal(-90), signal(null)]).toEqual(['good', 'fair', 'weak', null]);
  const now = Date.parse('2026-11-23T00:00:00Z');
  expect(calibrationDue({ calibrated_at: null }, now)).toBe(true);
  expect(calibrationDue({ calibrated_at: '2026-10-01T00:00:00Z' }, now)).toBe(false);
  expect(calibrationDue({ calibrated_at: '2026-06-01T00:00:00Z' }, now)).toBe(true);
});

import { checkEligibility } from '@/features/intel/schemes';
it('scheme questionnaire applies published exclusions', () => {
  const base = { land: 'own' as const, crop: true, sectors: ['agriculture'], species: [], category: 'general' as const, taxPayer: false, govtEmployee: false };
  expect(checkEligibility('pm_kisan', base).result).toBe('likely');
  expect(checkEligibility('pm_kisan', { ...base, taxPayer: true }).result).toBe('no');
  expect(checkEligibility('pm_kisan', { ...base, land: 'tenant' }).result).toBe('no');
  expect(checkEligibility('pmfby', { ...base, land: 'tenant' }).result).toBe('likely');
  expect(checkEligibility('pmmsy', { ...base, sectors: ['aquaculture'], category: 'woman' }).reason).toBe('elig.r.pmmsyHigher');
  expect(checkEligibility('rgm', { ...base, species: ['goat'] }).result).toBe('check');
});
