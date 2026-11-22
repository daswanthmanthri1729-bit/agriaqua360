import { z } from 'zod';

const optNum = (max: number) =>
  z.string().trim().refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= max), 'validation.number');
const optDate = z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'validation.date');

export const SOIL_TYPES = ['alluvial', 'black', 'red', 'laterite', 'sandy', 'clay', 'loamy'] as const;
export const IRRIGATION = ['canal', 'borewell', 'well', 'tank', 'river', 'rainfed', 'drip', 'sprinkler'] as const;
export const SEASONS = ['kharif', 'rabi', 'zaid', 'perennial'] as const;
export const CROP_STATUS = ['planned', 'growing', 'harvested', 'failed'] as const;
export const ACTIVITIES = ['sowing', 'irrigation', 'fertilizer', 'pesticide', 'weeding', 'harvest', 'observation', 'other'] as const;
export const SCAN_TYPES = ['disease', 'pest', 'condition'] as const;
// Common crops in AP/Telangana/North India; label keys under crops.names.*
export const COMMON_CROPS = ['paddy', 'cotton', 'chilli', 'maize', 'sugarcane', 'groundnut', 'turmeric', 'banana', 'tomato', 'wheat'] as const;

export const farmSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(80, 'validation.nameMax'),
  farm_type: z.enum(['agriculture', 'aquaculture', 'livestock', 'mixed']),
  area_acres: optNum(100000),
  soil_type: z.union([z.literal(''), z.enum(SOIL_TYPES)]),
  irrigation_source: z.union([z.literal(''), z.enum(IRRIGATION)]),
  village: z.string().trim().max(80),
  district: z.string().trim().max(80),
  state: z.string().trim().max(80),
  notes: z.string().trim().max(500, 'validation.tooLong'),
});

export const cropSchema = z
  .object({
    farm_id: z.string().min(1, 'validation.selectFarm'),
    name: z.string().trim().min(1, 'validation.required').max(60, 'validation.nameMax'),
    variety: z.string().trim().max(60),
    season: z.union([z.literal(''), z.enum(SEASONS)]),
    area_acres: optNum(100000),
    sowing_date: optDate,
    expected_harvest_date: optDate,
    notes: z.string().trim().max(500, 'validation.tooLong'),
  })
  .refine((v) => !v.sowing_date || !v.expected_harvest_date || v.expected_harvest_date >= v.sowing_date, {
    path: ['expected_harvest_date'], message: 'validation.harvestAfterSowing',
  });

export const activitySchema = z.object({
  crop_id: z.string().min(1, 'validation.selectCrop'),
  activity: z.enum(ACTIVITIES),
  scheduled_for: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date'),
  notes: z.string().trim().max(300, 'validation.tooLong'),
  remind: z.boolean(),
});

export type FarmInput = z.input<typeof farmSchema>;
export type CropInput = z.input<typeof cropSchema>;
export type ActivityInput = z.input<typeof activitySchema>;

// Form strings → DB row (empty → null, numeric strings → numbers).
export const blankToNull = <T extends Record<string, unknown>>(v: T, numeric: (keyof T)[] = []) =>
  Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' ? null : numeric.includes(k) ? Number(x) : x]));
