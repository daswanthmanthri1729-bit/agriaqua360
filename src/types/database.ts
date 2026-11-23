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
  boundary?: [number, number][] | null; boundary_area_ha?: number | null;
};

export type Season = 'kharif' | 'rabi' | 'zaid' | 'perennial';
export type CropStatus = 'planned' | 'growing' | 'harvested' | 'failed';
export type Crop = {
  id: string; owner_id: string; farm_id: string; name: string; variety: string | null; season: Season | null;
  area_acres: number | null; sowing_date: string | null; expected_harvest_date: string | null; status: CropStatus;
  photo_path: string | null; notes: string | null; created_at: string;
  growth_stage?: GrowthStage | null;
};
export type GrowthStage = 'germination' | 'vegetative' | 'flowering' | 'fruiting' | 'maturity' | 'harvest';

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
  latitude?: number | null; longitude?: number | null;
};
export type WaterReading = {
  id: string; pond_id: string; recorded_at: string; ph: number | null; dissolved_oxygen_mgl: number | null; temperature_c: number | null;
  ammonia_mgl: number | null; salinity_ppt: number | null; turbidity_cm: number | null; notes: string | null;
  source?: 'manual' | 'sensor' | 'simulated'; water_level_cm?: number | null; turbidity_ntu?: number | null;
};
export type FishRecordType = 'stocking' | 'feeding' | 'sampling' | 'mortality' | 'harvest' | 'treatment';
export type FishRecord = { id: string; pond_id: string; record_type: FishRecordType; recorded_on: string; quantity: number | null; unit: string | null; avg_weight_g: number | null; notes: string | null;
  count?: number | null; cause?: string | null; feed_type?: string | null; avg_length_cm?: number | null };
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

// ---------- Level 2 (migrations 0008–0013) ----------
export type ReadingSource = 'sensor' | 'simulated' | 'manual' | 'api' | 'ai_estimate';
export type DeviceKind = 'field_node' | 'pond_node' | 'gateway' | 'controller' | 'collar';
export type SensorDevice = {
  id: string; owner_id: string; farm_id: string | null; pond_id: string | null; animal_id: string | null; name: string; kind: DeviceKind;
  hardware: string; is_simulated: boolean; transport: 'https' | 'mqtt'; reporting_interval_s: number; firmware: string | null;
  battery_pct: number | null; rssi_dbm: number | null; last_seen_at: string | null; created_at: string;
};
export type DeviceChannel = {
  id: string; device_id: string; channel: string; kind: 'sensor' | 'actuator'; sensor_type: string | null; actuator_type: string | null; label: string | null;
  enabled: boolean; calibration_offset: number; calibration_scale: number; calibrated_at: string | null; max_run_s: number | null;
  state: 'on' | 'off' | 'unknown' | null; state_at: string | null; manual_override: boolean;
};
export type LatestValue = { device_id: string; sensor_type: string; value: number; source: ReadingSource; quality: string; recorded_at: string; pond_id: string | null; farm_id: string | null; animal_id: string | null };
export type SeriesPoint = { bucket: string; avg_value: number; min_value: number; max_value: number; n: number; sources: ReadingSource[] };
export type SensorAlert = {
  id: string; device_id: string | null; pond_id: string | null; farm_id: string | null; animal_id: string | null; sensor_type: string | null;
  kind: 'low' | 'high' | 'offline' | 'battery' | 'geofence' | 'rejected'; value: number | null; limit_value: number | null; source: 'sensor' | 'simulated';
  status: 'open' | 'acknowledged' | 'resolved'; created_at: string; acknowledged_at: string | null; resolved_at: string | null;
};
export type Threshold = { id: string; device_id: string | null; pond_id: string | null; farm_id: string | null; sensor_type: string; min_value: number | null; max_value: number | null; enabled: boolean };
export type ActuatorCommand = { id: string; device_id: string; channel: string; action: 'on' | 'off'; duration_s: number | null; requested_by: 'user' | 'rule'; status: string; result: string | null; created_at: string };
export type AutomationRule = {
  id: string; name: string; enabled: boolean; sensor_device_id: string; sensor_type: string; operator: '<' | '>'; threshold: number;
  target_device_id: string; target_channel: string; action: 'on' | 'off'; duration_s: number | null; cooldown_min: number; last_fired_at: string | null;
};
export type Geofence = { id: string; farm_id: string | null; name: string; polygon: [number, number][]; enabled: boolean };
export type AnimalLocation = { id: number; animal_id: string; latitude: number; longitude: number; accuracy_m: number | null; source: string; recorded_at: string };
export type SoilTest = {
  id: string; farm_id: string; tested_on: string; source: 'lab' | 'soil_health_card' | 'field_kit'; lab_name: string | null; sample_depth_cm: number | null;
  ph: number | null; ec_dsm: number | null; organic_carbon_pct: number | null; nitrogen_kg_ha: number | null; phosphorus_kg_ha: number | null; potassium_kg_ha: number | null;
  sulphur_ppm: number | null; zinc_ppm: number | null; iron_ppm: number | null; report_path: string | null; notes: string | null; created_at: string;
};
export type SatelliteObservation = { id: string; farm_id: string; provider: string; scene_id: string; acquired_at: string; cloud_pct: number | null; resolution_m: number; valid_pixel_pct: number | null; ndvi_mean: number | null; ndvi_min: number | null; ndvi_max: number | null; stress_pct: number | null };
export type AnimalRecordType = 'weight' | 'milk' | 'feeding' | 'heat' | 'insemination' | 'pregnancy_check' | 'birth' | 'dry_off';
export type AnimalRecord = { id: string; animal_id: string; record_type: AnimalRecordType; recorded_on: string; value: number | null; session: 'morning' | 'evening' | null; detail: string | null; due_on: string | null; notes: string | null };
export type Scheme = { code: string; level: 'central' | 'state'; state: string | null; sectors: string[]; name: Record<string, string>; summary: Record<string, string>; rules: { requires_land?: boolean; crop_required?: boolean; species?: string[] }; official_url: string; info_as_of: string };
export type SchemeTracking = { id: string; scheme_code: string; status: 'interested' | 'applied' | 'approved' | 'rejected'; applied_on: string | null; reference_no: string | null; notes: string | null };
export type TxKind = 'expense' | 'income';
export type FarmTransaction = { id: string; kind: TxKind; category: string; amount: number; occurred_on: string; farm_id: string | null; crop_id: string | null; pond_id: string | null; animal_id: string | null; quantity: number | null; unit: string | null; notes: string | null };
export type FinanceRow = { scope: string; scope_id: string | null; income: number; expense: number; profit: number };
export type PriceAlert = { id: string; commodity: string; state: string | null; market: string | null; direction: 'above' | 'below'; price: number; enabled: boolean; last_triggered_at: string | null };
export type UserPreferences = { owner_id: string; notify: Record<string, boolean>; quiet_from: string | null; quiet_to: string | null };
