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
  quantity: number | null; unit: string | null; notes: string | null; created_at: string;
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
export type TreatmentType = 'organic' | 'chemical' | 'cultural' | 'biological';
