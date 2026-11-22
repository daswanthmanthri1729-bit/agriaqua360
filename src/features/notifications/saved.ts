import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { must, queryClient } from '@/lib/query';

export type SavedRecord = { id: string; record_type: string; record_id: string; title: string | null; note: string | null; created_at: string };

export const useSaved = () =>
  useQuery({ queryKey: ['saved'], queryFn: () => must<SavedRecord[]>(supabase.from('saved_records').select('*').order('created_at', { ascending: false }).limit(200)) });

export const useRemoveSaved = () =>
  useMutation({ mutationFn: (id: string) => must(supabase.from('saved_records').delete().eq('id', id)), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved'] }) });

export const useSaveFishReport = () =>
  useMutation({
    mutationFn: (r: { id: string; title: string }) =>
      must(supabase.from('saved_records').upsert({ record_type: 'fish_health_report', record_id: r.id, title: r.title }, { onConflict: 'owner_id,record_type,record_id' })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved'] }),
  });

/** Where a saved item opens. ai_message needs its conversation, looked up when tapped. */
export async function savedRoute(r: SavedRecord): Promise<string | null> {
  switch (r.record_type) {
    case 'disease_report': {
      const { data } = await supabase.from('disease_reports').select('scan_id').eq('id', r.record_id).maybeSingle();
      return data ? `/agriculture/scan/${data.scan_id}` : null;
    }
    case 'fish_health_report': {
      const { data } = await supabase.from('fish_health_reports').select('pond_id').eq('id', r.record_id).maybeSingle();
      return data ? `/aquaculture/fish-scan?reportId=${r.record_id}${data.pond_id ? `&pondId=${data.pond_id}` : ''}` : null;
    }
    case 'ai_message': {
      const { data } = await supabase.from('ai_messages').select('conversation_id').eq('id', r.record_id).maybeSingle();
      return data ? `/assistant?id=${data.conversation_id}` : null;
    }
    default:
      return null;
  }
}
