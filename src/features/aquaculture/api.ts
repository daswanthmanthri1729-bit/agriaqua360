import { useOfflineInsert } from '@/hooks/useOfflineInsert';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invoke, must, queryClient, userId } from '@/lib/query';
import { PickedImage, uploadImage } from '@/services/media';
import { blankToNull } from '@/features/agriculture/schemas';
import type { FishHealthReport, FishRecord, Pond, WaterReading } from '@/types/database';
import type { Language } from '@/locales';
import { PARAMS } from './waterQuality';
import { FishRecordInput, PondInput, ReadingInput } from './schemas';

const invalidate = (...keys: string[]) => Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

export type PondWithLatest = Pond & { latest: WaterReading | null };

// Ponds + their newest reading (latest_water_readings view: one row per pond, RLS-scoped).
export const usePonds = () =>
  useQuery({
    queryKey: ['ponds'],
    queryFn: async () => {
      const [ponds, readings] = await Promise.all([
        must<Pond[]>(supabase.from('ponds').select('*').order('created_at', { ascending: false })),
        must<WaterReading[]>(supabase.from('latest_water_readings').select('*')),
      ]);
      return ponds.map((p) => ({ ...p, latest: readings.find((r) => r.pond_id === p.id) ?? null })) as PondWithLatest[];
    },
  });

export const usePond = (id: string) =>
  useQuery({ queryKey: ['ponds', id], queryFn: () => must<Pond>(supabase.from('ponds').select('*').eq('id', id).single()) });

export const useCreatePond = () =>
  useMutation({
    mutationFn: (input: PondInput) =>
      must<Pond>(supabase.from('ponds').insert(blankToNull(input, ['area_acres', 'depth_m', 'stocking_count'])).select().single()),
    onSuccess: () => invalidate('ponds', 'aqua'),
  });

export const useUpdatePond = () =>
  useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<Pond> }) => must(supabase.from('ponds').update(patch).eq('id', id)), onSuccess: () => invalidate('ponds', 'aqua') });

export const useDeletePond = () =>
  useMutation({ mutationFn: (id: string) => must(supabase.from('ponds').delete().eq('id', id)), onSuccess: () => invalidate('ponds', 'readings', 'fish', 'fishReports', 'aqua') });

// ---------- water quality ----------
export const useReadings = (pondId?: string) =>
  useQuery({
    queryKey: ['readings', { pondId }],
    queryFn: () => {
      let q = supabase.from('water_quality_records').select('*').order('recorded_at', { ascending: false }).limit(100);
      if (pondId) q = q.eq('pond_id', pondId);
      return must<WaterReading[]>(q);
    },
  });

export const useAddReading = () =>
  useOfflineInsert('water_quality_records', (input: ReadingInput) => blankToNull(input, PARAMS.map((p) => p.key)));

// ---------- fish records ----------
export const useFishRecords = (pondId: string) =>
  useQuery({ queryKey: ['fish', pondId], queryFn: () => must<FishRecord[]>(supabase.from('fish_records').select('*').eq('pond_id', pondId).order('recorded_on', { ascending: false }).limit(100)) });

export const useAddFishRecord = () =>
  useOfflineInsert('fish_records', ({ pondId, input }: { pondId: string; input: FishRecordInput }) =>
    ({ pond_id: pondId, ...blankToNull({ ...input, feed_type: input.feed_type || null, cause: input.cause ?? null }, ['quantity', 'avg_weight_g']) }));

// ---------- fish health ----------
export const useFishReports = (pondId?: string) =>
  useQuery({
    queryKey: ['fishReports', { pondId }],
    queryFn: () => {
      let q = supabase.from('fish_health_reports').select('*').order('created_at', { ascending: false }).limit(20);
      if (pondId) q = q.eq('pond_id', pondId);
      return must<FishHealthReport[]>(q);
    },
  });

/** Uploads once; on AI failure the caller keeps `paths` and retries without re-uploading. */
export async function uploadFishPhotos(images: PickedImage[]) {
  const uid = await userId();
  return Promise.all(images.map((img) => uploadImage('media', 'scans', uid, img)));
}

export async function analyseFish(args: { paths: string[]; pondId: string | null; observations: string; language: Language }) {
  const report = await invoke<FishHealthReport>('fish-scan', { image_paths: args.paths, pond_id: args.pondId, observations: args.observations, language: args.language });
  await invalidate('fishReports', 'aqua');
  return report;
}
