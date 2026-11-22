import { z } from 'zod';
import type { Species } from '@/types/database';

const optNum = (max: number) =>
  z.string().trim().refine((v) => v === '' || (!isNaN(Number(v)) && Number(v) >= 0 && Number(v) <= max), 'validation.number');
const optDate = z.string().refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), 'validation.date');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date');

export const SPECIES = ['cow', 'buffalo', 'sheep', 'goat', 'pig'] as const;
export const ANIMAL_STATUS = ['healthy', 'sick', 'under_treatment', 'pregnant', 'sold', 'deceased'] as const;
export const HEALTH_TYPES = ['checkup', 'illness', 'treatment', 'deworming', 'injury'] as const;

// Common Indian breeds / vaccines as quick picks. Proper names, shown as-is in every language.
export const BREEDS: Record<Species, string[]> = {
  cow: ['Gir', 'Sahiwal', 'Ongole', 'Red Sindhi', 'HF cross', 'Jersey cross'],
  buffalo: ['Murrah', 'Jaffarabadi', 'Mehsana', 'Godavari', 'Surti'],
  sheep: ['Nellore', 'Deccani', 'Madras Red', 'Marwari'],
  goat: ['Jamunapari', 'Beetal', 'Black Bengal', 'Osmanabadi', 'Sirohi'],
  pig: ['Large White Yorkshire', 'Hampshire', 'Ghungroo', 'Desi'],
};
export const VACCINES: Record<Species, string[]> = {
  cow: ['FMD', 'HS', 'BQ', 'Brucellosis', 'Lumpy Skin (LSD)', 'Theileriosis'],
  buffalo: ['FMD', 'HS', 'BQ', 'Brucellosis'],
  sheep: ['PPR', 'Enterotoxaemia (ET)', 'Sheep Pox', 'FMD', 'HS'],
  goat: ['PPR', 'Enterotoxaemia (ET)', 'Goat Pox', 'FMD', 'HS'],
  pig: ['Classical Swine Fever (CSF)', 'FMD'],
};

export const animalSchema = z.object({
  species: z.enum(SPECIES),
  tag_id: z.string().trim().max(30, 'validation.tooLong'),
  name: z.string().trim().max(40, 'validation.nameMax'),
  breed: z.string().trim().max(40, 'validation.tooLong'),
  sex: z.union([z.literal(''), z.enum(['male', 'female'])]),
  birth_date: optDate,
  weight_kg: optNum(2000),
  status: z.enum(ANIMAL_STATUS),
  notes: z.string().trim().max(500, 'validation.tooLong'),
}).refine((v) => v.tag_id !== '' || v.name !== '', { path: ['tag_id'], message: 'validation.tagOrName' });

export const healthSchema = z.object({
  record_type: z.enum(HEALTH_TYPES),
  recorded_on: date,
  description: z.string().trim().min(1, 'validation.required').max(500, 'validation.tooLong'),
  vet_name: z.string().trim().max(60, 'validation.tooLong'),
  follow_up_on: optDate,
}).refine((v) => !v.follow_up_on || v.follow_up_on >= v.recorded_on, { path: ['follow_up_on'], message: 'validation.followUpAfter' });

export const vaccinationSchema = z.object({
  vaccine_name: z.string().trim().min(1, 'validation.required').max(60, 'validation.tooLong'),
  dose: z.string().trim().max(40, 'validation.tooLong'),
  given: z.boolean(),
  date,
  notes: z.string().trim().max(300, 'validation.tooLong'),
});

export type AnimalInput = z.input<typeof animalSchema>;
export type HealthInput = z.input<typeof healthSchema>;
export type VaccinationInput = z.input<typeof vaccinationSchema>;
