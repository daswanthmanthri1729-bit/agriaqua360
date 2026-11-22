import { daysBetween } from '@/lib/dates';
import type { Vaccination } from '@/types/database';

export type VaccState = 'done' | 'overdue' | 'due_soon' | 'scheduled' | 'missed';

/** Display state of a vaccination on `today` (YYYY-MM-DD). "due soon" = within 7 days. */
export function vaccState(v: Pick<Vaccination, 'status' | 'due_on'>, today: string): VaccState {
  if (v.status === 'completed') return 'done';
  if (v.status === 'missed') return 'missed';
  if (!v.due_on) return 'scheduled';
  const d = daysBetween(today, v.due_on);
  return d < 0 ? 'overdue' : d <= 7 ? 'due_soon' : 'scheduled';
}

/** Age in whole months from birth date (null if unknown or in the future). */
export function ageMonths(birth: string | null, today: string): number | null {
  if (!birth || birth > today) return null;
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
}
