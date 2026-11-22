import type { Language } from '@/locales';
import type { Sector } from '@/features/auth/schemas';

// Mirrors supabase/migrations/20261122000001_initial_schema.sql
export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  preferred_language: Language;
  sectors: Sector[];
  village: string | null;
  district: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  land_acres: number | null;
  experience_years: number | null;
  avatar_path: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type FarmType = 'agriculture' | 'aquaculture' | 'livestock' | 'mixed';
export type Farm = {
  id: string; owner_id: string; name: string; farm_type: FarmType; area_acres: number | null;
  soil_type: string | null; irrigation_source: string | null; village: string | null; district: string | null; state: string | null;
  latitude: number | null; longitude: number | null; photo_path: string | null; notes: string | null; created_at: string;
};

export type Season = 'kharif' | 'rabi' | 'zaid' | 'perennial';
export type CropStatus = 'planned' | 'growing' | 'harvested' | 'failed';
export type Crop = {
  id: string; owner_id: string; farm_id: string; name: string; variety: string | null; season: Season | null;
  area_acres: number | null; sowing_date: string | null; expected_harvest_date: string | null; status: CropStatus;
  photo_path: string | null; notes: string | null; created_at: string;
};

export type Activity = 'sowing' | 'irrigation' | 'fertilizer' | 'pesticide' | 'weeding' | 'harvest' | 'observation' | 'other';
export type CropRecord = {
  id: string; crop_id: string; activity: Activity; scheduled_for: string | null; completed_at: string | null;
  quantity: number | null; unit: string | null; notes: string | null; notification_id: string | null; created_at: string;
};

export type ScanType = 'disease' | 'pest' | 'condition';
export type CropScan = {
  id: string; crop_id: string | null; image_paths: string[]; scan_type: ScanType;
  status: 'pending' | 'completed' | 'failed'; language: Language; created_at: string;
};

export type Confidence = 'low' | 'medium' | 'high';
export type Severity = 'none' | 'mild' | 'moderate' | 'severe';
export type CropReport = {
  is_plant_image: boolean; crop_identified?: string; condition_name: string; confidence: Confidence; severity: Severity;
  summary: string; symptoms: string[]; causes: string[];
  treatments: { cultural: string[]; organic: string[]; chemical: string[]; prevention: string[] };
  recommend_expert: boolean; expert_reason?: string; retake_tips?: string[];
};
export type DiseaseReport = {
  id: string; scan_id: string; condition_name: string | null; confidence: Confidence | null; severity: Severity | null;
  summary: string | null; symptoms: string[] | null; recommend_expert: boolean; raw_response: CropReport | null; created_at: string;
};
export type TreatmentType = 'organic' | 'chemical' | 'cultural' | 'biological' | 'prevention';

export type PondStatus = 'preparing' | 'active' | 'harvested' | 'idle';
export type Pond = {
  id: string; farm_id: string | null; name: string; species: string | null; area_acres: number | null; depth_m: number | null;
  stocking_date: string | null; stocking_count: number | null; status: PondStatus; photo_path: string | null; notes: string | null; created_at: string;
};
export type WaterReading = {
  id: string; pond_id: string; recorded_at: string; ph: number | null; dissolved_oxygen_mgl: number | null; temperature_c: number | null;
  ammonia_mgl: number | null; salinity_ppt: number | null; turbidity_cm: number | null; notes: string | null;
};
export type FishRecordType = 'stocking' | 'feeding' | 'sampling' | 'mortality' | 'harvest' | 'treatment';
export type FishRecord = { id: string; pond_id: string; record_type: FishRecordType; recorded_on: string; quantity: number | null; unit: string | null; avg_weight_g: number | null; notes: string | null };
export type FishReport = {
  is_fish_image: boolean; species_identified?: string; condition_name: string; confidence: Confidence; severity: Severity; summary: string;
  signs: string[]; possible_causes: string[]; immediate_actions: string[]; water_management: string[]; prevention: string[];
  recommend_expert: boolean; expert_reason?: string; retake_tips?: string[];
};
export type FishHealthReport = {
  id: string; pond_id: string | null; image_paths: string[]; observations: string | null; condition_name: string | null;
  confidence: Confidence | null; severity: Severity | null; summary: string | null; recommend_expert: boolean; raw_response: FishReport | null; created_at: string;
};

export type Species = 'cow' | 'buffalo' | 'sheep' | 'goat' | 'pig';
export type AnimalStatus = 'healthy' | 'sick' | 'under_treatment' | 'pregnant' | 'sold' | 'deceased';
export type Animal = {
  id: string; farm_id: string | null; species: Species; tag_id: string | null; name: string | null; breed: string | null; sex: 'male' | 'female' | null;
  birth_date: string | null; weight_kg: number | null; status: AnimalStatus; photo_path: string | null; notes: string | null; created_at: string;
};
export type HealthRecordType = 'checkup' | 'illness' | 'treatment' | 'deworming' | 'injury' | 'ai_assessment';
export type HealthRecord = {
  id: string; animal_id: string; record_type: HealthRecordType; recorded_on: string; description: string | null; vet_name: string | null;
  image_paths: string[]; follow_up_on: string | null; notification_id: string | null; created_at: string;
};
export type Vaccination = {
  id: string; animal_id: string; vaccine_name: string; dose: string | null; given_on: string | null; due_on: string | null;
  status: 'scheduled' | 'completed' | 'missed'; notes: string | null; notification_id: string | null; created_at: string;
};
