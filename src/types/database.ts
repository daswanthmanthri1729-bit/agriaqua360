import type { Language } from '@/locales';
import type { Sector } from '@/features/auth/schemas';

// Mirrors public.profiles in supabase/migrations/20261122000001_initial_schema.sql
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
