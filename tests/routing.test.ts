import { nextRoute } from '@/features/auth/routing';

const prefs = { language: null, onboardingDone: false, permissionsReviewed: false };
const session = { user: { id: 'u' } } as never;

it.each([
  [{ prefs, session: null, profile: null }, '/onboarding/welcome'],
  [{ prefs: { ...prefs, language: 'te' }, session: null, profile: null }, '/onboarding/permissions'],
  [{ prefs: { ...prefs, language: 'te', permissionsReviewed: true }, session: null, profile: null }, '/auth/register'],
  [{ prefs: { ...prefs, onboardingDone: true }, session: null, profile: null }, '/auth/login'],
  [{ prefs, session, profile: { onboarding_completed: false } }, '/auth/profile-setup'],
  [{ prefs, session, profile: { onboarding_completed: true } }, '/home'],
])('routes %#', (input, expected) => expect(nextRoute(input as never)).toBe(expected));
