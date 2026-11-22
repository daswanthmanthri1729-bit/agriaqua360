import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invoke, must, queryClient, userId } from '@/lib/query';
import { PickedImage, uploadImage } from '@/services/media';
import { scheduleReminder } from '@/services/notifications';
import { addDays, today } from '@/lib/dates';
import type { Activity, Crop, CropRecord, CropScan, DiseaseReport, Farm, ScanType, TreatmentType } from '@/types/database';
import { ActivityInput, blankToNull, CropInput, FarmInput } from './schemas';
import type { Language } from '@/locales';

const invalidate = (...keys: string[]) => Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

// ---------- farms ----------
export const useFarms = () =>
  useQuery({ queryKey: ['farms'], queryFn: () => must<Farm[]>(supabase.from('farms').select('*').order('created_at', { ascending: false })) });

export const useFarm = (id: string) =>
  useQuery({ queryKey: ['farms', id], queryFn: () => must<Farm>(supabase.from('farms').select('*').eq('id', id).single()) });

export const useCreateFarm = () =>
  useMutation({
    mutationFn: async ({ input, photo, coords }: { input: FarmInput; photo?: PickedImage | null; coords?: { latitude: number; longitude: number } | null }) => {
      const uid = await userId();
      const photo_path = photo ? await uploadImage('media', 'farms', uid, photo) : null;
      return must<Farm>(supabase.from('farms').insert({ ...blankToNull(input, ['area_acres']), ...(coords ?? {}), photo_path }).select().single());
    },
    onSuccess: () => invalidate('farms', 'dashboard'),
  });

export const useDeleteFarm = () =>
  useMutation({
    mutationFn: (id: string) => must(supabase.from('farms').delete().eq('id', id)),
    onSuccess: () => invalidate('farms', 'crops', 'records', 'dashboard'),
  });

// ---------- crops ----------
export const useCrops = (farmId?: string) =>
  useQuery({
    queryKey: ['crops', { farmId }],
    queryFn: () => {
      let q = supabase.from('crops').select('*, farm:farms(name)').order('created_at', { ascending: false });
      if (farmId) q = q.eq('farm_id', farmId);
      return must<(Crop & { farm: { name: string } | null })[]>(q);
    },
  });

export const useCrop = (id: string) =>
  useQuery({ queryKey: ['crops', id], queryFn: () => must<Crop & { farm: { name: string } | null }>(supabase.from('crops').select('*, farm:farms(name)').eq('id', id).single()) });

export const useCreateCrop = () =>
  useMutation({
    mutationFn: async ({ input, photo }: { input: CropInput; photo?: PickedImage | null }) => {
      const uid = await userId();
      const photo_path = photo ? await uploadImage('media', 'crops', uid, photo) : null;
      const crop = await must<Crop>(supabase.from('crops').insert({ ...blankToNull(input, ['area_acres']), photo_path }).select().single());
      // A sowing date doubles as the first calendar entry.
      if (crop.sowing_date) await supabase.from('crop_records').insert({ crop_id: crop.id, activity: 'sowing', scheduled_for: crop.sowing_date, completed_at: crop.sowing_date <= today() ? new Date().toISOString() : null });
      return crop;
    },
    onSuccess: () => invalidate('crops', 'records', 'dashboard'),
  });

export const useUpdateCrop = () =>
  useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Crop> }) => must(supabase.from('crops').update(patch).eq('id', id)),
    onSuccess: () => invalidate('crops', 'dashboard'),
  });

export const useDeleteCrop = () =>
  useMutation({ mutationFn: (id: string) => must(supabase.from('crops').delete().eq('id', id)), onSuccess: () => invalidate('crops', 'records', 'scans', 'dashboard') });

// ---------- calendar (crop_records) ----------
export type RecordWithCrop = CropRecord & { crop: { id: string; name: string } | null };
export const useRecords = (opts: { cropId?: string; from?: string; to?: string } = {}) =>
  useQuery({
    queryKey: ['records', opts],
    queryFn: () => {
      let q = supabase.from('crop_records').select('*, crop:crops(id, name)').order('scheduled_for', { ascending: true }).limit(300);
      if (opts.cropId) q = q.eq('crop_id', opts.cropId);
      if (opts.from) q = q.gte('scheduled_for', opts.from);
      if (opts.to) q = q.lte('scheduled_for', opts.to);
      return must<RecordWithCrop[]>(q);
    },
  });

export const useCreateRecord = () =>
  useMutation({
    mutationFn: async ({ input, cropName, title, body }: { input: ActivityInput; cropName: string; title: string; body: string }) => {
      const { remind, ...row } = input;
      const rec = await must<CropRecord>(supabase.from('crop_records').insert({ ...row, notes: row.notes || null }).select().single());
      if (remind) await scheduleReminder({ date: rec.scheduled_for!, title, body: `${cropName}: ${body}`, route: `/agriculture/crops/${rec.crop_id}`, category: 'crop' });
      return rec;
    },
    onSuccess: () => invalidate('records', 'dashboard'),
  });

export const useToggleRecord = () =>
  useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      must(supabase.from('crop_records').update({ completed_at: done ? new Date().toISOString() : null }).eq('id', id)),
    onSuccess: () => invalidate('records', 'dashboard'),
  });

// ---------- scans ----------
export const useScans = (cropId?: string) =>
  useQuery({
    queryKey: ['scans', { cropId }],
    queryFn: () => {
      let q = supabase.from('crop_scans').select('*, report:disease_reports(id, condition_name, severity)').order('created_at', { ascending: false }).limit(20);
      if (cropId) q = q.eq('crop_id', cropId);
      return must<(CropScan & { report: Pick<DiseaseReport, 'id' | 'condition_name' | 'severity'>[] })[]>(q);
    },
  });

export const useScan = (id: string) =>
  useQuery({
    queryKey: ['scans', id],
    queryFn: () => must<CropScan & { crop: Pick<Crop, 'id' | 'name'> | null; report: DiseaseReport[] }>(
      supabase.from('crop_scans').select('*, crop:crops(id, name), report:disease_reports(*)').eq('id', id).single(),
    ),
  });

/** Uploads photos, creates the scan row, then asks the server to analyse it. Returns the scan id. */
export async function createScan(args: { images: PickedImage[]; cropId: string | null; scanType: ScanType; language: Language }) {
  const uid = await userId();
  const image_paths = await Promise.all(args.images.map((img) => uploadImage('media', 'scans', uid, img)));
  const scan = await must<CropScan>(supabase.from('crop_scans').insert({ image_paths, crop_id: args.cropId, scan_type: args.scanType, language: args.language }).select().single());
  await supabase.from('uploaded_media').insert(image_paths.map((path) => ({ bucket: 'media', path, entity_type: 'crop_scan', entity_id: scan.id, mime_type: 'image/jpeg' })));
  return scan.id;
}

export async function analyseScan(scanId: string) {
  const report = await invoke<DiseaseReport>('crop-scan', { scan_id: scanId });
  await invalidate('scans');
  return report;
}

export const useSaveRecord = () =>
  useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      must(supabase.from('saved_records').upsert({ record_type: 'disease_report', record_id: id, title }, { onConflict: 'owner_id,record_type,record_id' })),
    onSuccess: () => invalidate('saved'),
  });

export const useIsSaved = (id?: string) =>
  useQuery({
    queryKey: ['saved', id],
    enabled: !!id,
    queryFn: async () => (await must<{ id: string }[]>(supabase.from('saved_records').select('id').eq('record_type', 'disease_report').eq('record_id', id!))).length > 0,
  });

// ---------- treatments ----------
export const useAddTreatments = () =>
  useMutation({
    mutationFn: async (a: { reportId: string; cropId: string | null; items: { type: TreatmentType; text: string }[]; followUp: string; reminder: { title: string; body: string } }) => {
      await must(supabase.from('treatment_records').insert(a.items.map((i) => ({
        disease_report_id: a.reportId, crop_id: a.cropId, treatment_type: i.type, description: i.text, applied_on: today(), follow_up_on: a.followUp,
      }))));
      if (a.cropId) {
        await must(supabase.from('crop_records').insert({ crop_id: a.cropId, activity: 'observation', scheduled_for: a.followUp, notes: a.reminder.body }));
      }
      await scheduleReminder({ date: a.followUp, title: a.reminder.title, body: a.reminder.body, route: a.cropId ? `/agriculture/crops/${a.cropId}` : '/agriculture/calendar', category: 'crop' });
    },
    onSuccess: () => invalidate('records', 'treatments', 'dashboard'),
  });

export const useTreatments = (cropId: string) =>
  useQuery({ queryKey: ['treatments', cropId], queryFn: () => must<{ id: string; treatment_type: TreatmentType; description: string; applied_on: string; follow_up_on: string | null }[]>(supabase.from('treatment_records').select('id, treatment_type, description, applied_on, follow_up_on').eq('crop_id', cropId).order('created_at', { ascending: false })) });

// ---------- dashboard ----------
export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const count = async (table: string, f?: (q: any) => any) => {
        let q = supabase.from(table).select('id', { count: 'exact', head: true });
        if (f) q = f(q);
        const { count: c, error } = await q;
        if (error) throw error;
        return c ?? 0;
      };
      const [farms, crops, acres, upcoming, overdue] = await Promise.all([
        count('farms'),
        count('crops', (q) => q.eq('status', 'growing')),
        must<{ area_acres: number | null }[]>(supabase.from('farms').select('area_acres')),
        must<RecordWithCrop[]>(supabase.from('crop_records').select('*, crop:crops(id, name)').is('completed_at', null).gte('scheduled_for', today()).lte('scheduled_for', addDays(today(), 7)).order('scheduled_for').limit(5)),
        count('crop_records', (q) => q.is('completed_at', null).lt('scheduled_for', today())),
      ]);
      return { farms, crops, acres: acres.reduce((s, f) => s + (Number(f.area_acres) || 0), 0), upcoming, overdue };
    },
  });

export const ACTIVITY_ICON: Record<Activity, string> = {
  sowing: 'grass', irrigation: 'water-drop', fertilizer: 'science', pesticide: 'pest-control', weeding: 'content-cut', harvest: 'agriculture', observation: 'visibility', other: 'event-note',
};
