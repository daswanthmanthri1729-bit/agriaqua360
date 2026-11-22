import type { Href } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/database';

type Input = {
  prefs: { language: string | null; onboardingDone: boolean; permissionsReviewed: boolean };
  session: Session | null;
  profile: Profile | null;
};

// Single source of truth for where the app lands on launch / after auth.
export function nextRoute({ prefs, session, profile }: Input): Href {
  if (session) return profile?.onboarding_completed ? '/home' : '/auth/profile-setup';
  if (!prefs.onboardingDone) {
    if (!prefs.language) return '/onboarding/welcome';
    if (!prefs.permissionsReviewed) return '/onboarding/permissions';
    return '/auth/register';
  }
  return '/auth/login';
}
