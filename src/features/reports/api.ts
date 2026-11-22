import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { must } from '@/lib/query';

type Counts = Record<string, number>;
export type Report = {
  days: number;
  agriculture: { farms: number; acres: number; cropsByStatus: Counts; tasksDone: number; tasksOverdue: number; scans: number; scansBySeverity: Counts };
  aquaculture: { ponds: number; activePonds: number; readings: number; pondsByLevel: Counts; feedKg: number; harvestKg: number; mortality: number };
  livestock: { animals: number; bySpecies: Counts; sick: number; vaccinesGiven: number; vaccinesOverdue: number };
};

// Totals are computed in the database (report_summary, RLS-scoped) — one call instead of downloading every row.
export const useReport = (days: number) =>
  useQuery({ queryKey: ['report', days], queryFn: () => must<Report>(supabase.rpc('report_summary', { days })) });
