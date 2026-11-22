import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { must } from '@/lib/query';
import { today } from '@/lib/dates';
import { ReportInput, summarise } from './summary';

// shortcut: pulls rows and aggregates on the phone; fine for one family farm (hundreds of rows). Move to a SQL view if records reach tens of thousands.
export const useReport = (days: number) =>
  useQuery({
    queryKey: ['report', days],
    queryFn: async () => {
      // Column lists are dynamic strings, so supabase-js can't infer row types; summarise() declares them.
      const q = (table: string, cols: string) => must<unknown[]>(supabase.from(table).select(cols).limit(2000) as unknown as PromiseLike<{ data: unknown[] | null; error: unknown }>);
      const [farms, crops, records, scans, ponds, readings, fish, animals, vaccinations] = await Promise.all([
        q('farms', 'area_acres'), q('crops', 'status'), q('crop_records', 'scheduled_for, completed_at'), q('disease_reports', 'severity'),
        q('ponds', 'id, status'), q('water_quality_records', 'pond_id, recorded_at, ph, dissolved_oxygen_mgl, temperature_c, ammonia_mgl, turbidity_cm'),
        q('fish_records', 'record_type, recorded_on, quantity, unit'), q('livestock', 'species, status'), q('vaccination_records', 'status, due_on, given_on'),
      ]);
      return summarise({ farms, crops, records, scans, ponds, readings, fish, animals, vaccinations } as ReportInput, today(), days);
    },
  });
