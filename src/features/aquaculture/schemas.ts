import { z } from 'zod';
import { PARAMS } from './waterQuality';

const optNum = (max: number) =>
  z.string().trim().refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= max), 'validation.number');
const optDate = z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'validation.date');

export const POND_STATUS = ['preparing', 'active', 'harvested', 'idle'] as const;
export const SPECIES = ['vannamei', 'tiger', 'rohu', 'catla', 'tilapia', 'pangasius', 'murrel'] as const;
export const FISH_RECORD_TYPES = ['stocking', 'feeding', 'sampling', 'mortality', 'harvest', 'treatment'] as const;
export const UNITS = ['kg', 'pcs'] as const;
export const MORTALITY_CAUSES = ['disease', 'low_oxygen', 'water_quality', 'predator', 'handling', 'unknown', 'other'] as const;

export const pondSchema = z.object({
  name: z.string().trim().min(1, 'validation.required').max(60, 'validation.nameMax'),
  species: z.string().trim().max(60),
  area_acres: optNum(10000),
  depth_m: optNum(20),
  stocking_date: optDate,
  stocking_count: z.string().trim().refine((v) => v === '' || /^\d{1,9}$/.test(v), 'validation.number'),
  status: z.enum(POND_STATUS),
  notes: z.string().trim().max(500, 'validation.tooLong'),
});

export const readingSchema = z
  .object(Object.fromEntries(PARAMS.map((p) => [p.key, optNum(p.max)])) as Record<(typeof PARAMS)[number]['key'], ReturnType<typeof optNum>>)
  .extend({ pond_id: z.string().min(1, 'validation.selectPond'), notes: z.string().trim().max(300, 'validation.tooLong') })
  .refine((v) => PARAMS.some((p) => v[p.key] !== ''), { path: ['ph'], message: 'water.needOne' });

export const fishRecordSchema = z.object({
  record_type: z.enum(FISH_RECORD_TYPES),
  recorded_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date'),
  quantity: optNum(10_000_000),
  unit: z.enum(UNITS),
  avg_weight_g: optNum(100_000),
  notes: z.string().trim().max(300, 'validation.tooLong'),
  cause: z.enum(MORTALITY_CAUSES).nullable().optional(),
  feed_type: z.string().trim().max(60, 'validation.tooLong').optional(),
});

export type PondInput = z.input<typeof pondSchema>;
export type ReadingInput = z.input<typeof readingSchema>;
export type FishRecordInput = z.input<typeof fishRecordSchema>;
