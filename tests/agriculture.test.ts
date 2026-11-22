import { ACTIVITIES, activitySchema, blankToNull, COMMON_CROPS, CROP_STATUS, cropSchema, farmSchema, IRRIGATION, SCAN_TYPES, SEASONS, SOIL_TYPES } from '@/features/agriculture/schemas';
import { addDays, daysBetween, isoDate, parseDate } from '@/lib/dates';
import en from '@/locales/en/translation.json';

const get = (k: string) => k.split('.').reduce<any>((a, p) => a?.[p], en);
const issue = (r: any, f: string) => r.error?.issues.find((i: any) => i.path[0] === f)?.message;

it('every enum value has an English label', () => {
  const missing = [
    ...ACTIVITIES.map((v) => `calendar.activities.${v}`), ...SEASONS.map((v) => `crops.seasons.${v}`), ...CROP_STATUS.map((v) => `crops.statuses.${v}`),
    ...SOIL_TYPES.map((v) => `farmForm.soils.${v}`), ...IRRIGATION.map((v) => `farmForm.water.${v}`), ...COMMON_CROPS.map((v) => `crops.names.${v}`),
    ...SCAN_TYPES.map((v) => `scan.types.${v}`), ...['none', 'mild', 'moderate', 'severe'].map((v) => `result.severity.${v}`),
    ...['cultural', 'organic', 'chemical', 'prevention'].map((v) => `treatment.groups.${v}`),
    ...['Clear', 'Clouds', 'Rain', 'Drizzle', 'Thunderstorm', 'Snow', 'Mist'].map((v) => `weather.cond.${v}`),
    ...['heavy_rain', 'heat', 'strong_wind', 'cold'].map((v) => `weather.adv.${v}`),
    ...['ai_busy', 'ai_timeout', 'ai_blocked', 'ai_failed', 'ai_not_configured', 'image_missing', 'not_found', 'unauthorized', 'bad_request', 'weather_not_configured', 'weather_key_invalid', 'weather_unavailable', 'location_not_found'].map((v) => `errors.${v}`),
  ].filter((k) => typeof get(k) !== 'string');
  expect(missing).toEqual([]);
});

const farm = { name: 'Canal field', farm_type: 'agriculture', area_acres: '', soil_type: '', irrigation_source: '', village: '', district: '', state: '', notes: '' };
const crop = { farm_id: 'f1', name: 'Paddy', variety: '', season: '', area_acres: '', sowing_date: '', expected_harvest_date: '', notes: '' };

describe('schemas', () => {
  it('farm: name required, area numeric', () => {
    expect(farmSchema.safeParse(farm).success).toBe(true);
    expect(issue(farmSchema.safeParse({ ...farm, name: ' ' }), 'name')).toBe('validation.required');
    expect(issue(farmSchema.safeParse({ ...farm, area_acres: 'abc' }), 'area_acres')).toBe('validation.number');
  });
  it('crop: needs farm, harvest after sowing', () => {
    expect(cropSchema.safeParse(crop).success).toBe(true);
    expect(issue(cropSchema.safeParse({ ...crop, farm_id: '' }), 'farm_id')).toBe('validation.selectFarm');
    expect(issue(cropSchema.safeParse({ ...crop, sowing_date: '2026-07-01', expected_harvest_date: '2026-06-01' }), 'expected_harvest_date')).toBe('validation.harvestAfterSowing');
  });
  it('activity: date format', () => {
    expect(issue(activitySchema.safeParse({ crop_id: 'c', activity: 'irrigation', scheduled_for: '22/11/2026', notes: '', remind: false }), 'scheduled_for')).toBe('validation.date');
  });
  it('blankToNull converts blanks and numbers', () => {
    expect(blankToNull({ a: '', b: '2.5', c: 'x' }, ['b'])).toEqual({ a: null, b: 2.5, c: 'x' });
  });
});

describe('dates', () => {
  it('round-trips local dates and handles month ends', () => {
    expect(isoDate(parseDate('2026-02-28'))).toBe('2026-02-28');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(daysBetween('2026-06-15', '2026-11-22')).toBe(160);
  });
});
