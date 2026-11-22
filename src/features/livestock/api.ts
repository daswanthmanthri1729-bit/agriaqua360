import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { must, queryClient, userId } from '@/lib/query';
import { PickedImage, uploadImage } from '@/services/media';
import { cancelReminders, scheduleReminder } from '@/services/notifications';
import { blankToNull } from '@/features/agriculture/schemas';
import { today } from '@/lib/dates';
import type { Animal, HealthRecord, Vaccination } from '@/types/database';
import { AnimalInput, HealthInput, VaccinationInput } from './schemas';

const invalidate = (...keys: string[]) => Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

export const useAnimals = () =>
  useQuery({ queryKey: ['animals'], queryFn: () => must<Animal[]>(supabase.from('livestock').select('*').order('created_at', { ascending: false })) });

export const useAnimal = (id: string) =>
  useQuery({ queryKey: ['animals', id], queryFn: () => must<Animal>(supabase.from('livestock').select('*').eq('id', id).single()) });

export const useCreateAnimal = () =>
  useMutation({
    mutationFn: async ({ input, photo }: { input: AnimalInput; photo?: PickedImage | null }) => {
      const uid = await userId();
      const photo_path = photo ? await uploadImage('media', 'livestock', uid, photo) : null;
      return must<Animal>(supabase.from('livestock').insert({ ...blankToNull(input, ['weight_kg']), photo_path }).select().single());
    },
    onSuccess: () => invalidate('animals', 'livestockSummary'),
  });

export const useUpdateAnimal = () =>
  useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<Animal> }) => must(supabase.from('livestock').update(patch).eq('id', id)), onSuccess: () => invalidate('animals', 'livestockSummary') });

export const useDeleteAnimal = () =>
  useMutation({
    mutationFn: async (id: string) => {
      const [v, h] = await Promise.all([
        must<{ notification_id: string | null }[]>(supabase.from('vaccination_records').select('notification_id').eq('animal_id', id).not('notification_id', 'is', null)),
        must<{ notification_id: string | null }[]>(supabase.from('animal_health_records').select('notification_id').eq('animal_id', id).not('notification_id', 'is', null)),
      ]);
      await must(supabase.from('livestock').delete().eq('id', id));
      await cancelReminders([...v, ...h].map((r) => r.notification_id));
    },
    onSuccess: () => invalidate('animals', 'health', 'vaccinations', 'livestockSummary'),
  });

// ---------- health ----------
export const useHealthRecords = (animalId?: string) =>
  useQuery({
    queryKey: ['health', { animalId }],
    queryFn: () => {
      let q = supabase.from('animal_health_records').select('*, animal:livestock(id, name, tag_id, species)').order('recorded_on', { ascending: false }).limit(100);
      if (animalId) q = q.eq('animal_id', animalId);
      return must<(HealthRecord & { animal: Pick<Animal, 'id' | 'name' | 'tag_id' | 'species'> | null })[]>(q);
    },
  });

export const useAddHealthRecord = () =>
  useMutation({
    mutationFn: async (a: { animalId: string; input: HealthInput; photos: PickedImage[]; reminder: { title: string; body: string } }) => {
      const uid = await userId();
      const image_paths = await Promise.all(a.photos.map((p) => uploadImage('media', 'livestock', uid, p)));
      const notification_id = a.input.follow_up_on
        ? await scheduleReminder({ date: a.input.follow_up_on, ...a.reminder, route: `/livestock/animals/${a.animalId}`, category: 'animal_health' })
        : null;
      try {
        await must(supabase.from('animal_health_records').insert({ animal_id: a.animalId, ...blankToNull(a.input), image_paths, notification_id }));
      } catch (e) { await cancelReminders([notification_id]); throw e; }
    },
    onSuccess: () => invalidate('health', 'livestockSummary'),
  });

// ---------- vaccinations ----------
export const useVaccinations = (animalId?: string) =>
  useQuery({
    queryKey: ['vaccinations', { animalId }],
    queryFn: () => {
      let q = supabase.from('vaccination_records').select('*, animal:livestock(id, name, tag_id, species)').order('due_on', { ascending: true, nullsFirst: false }).limit(200);
      if (animalId) q = q.eq('animal_id', animalId);
      return must<(Vaccination & { animal: Pick<Animal, 'id' | 'name' | 'tag_id' | 'species'> | null })[]>(q);
    },
  });

export const useAddVaccination = () =>
  useMutation({
    mutationFn: async (a: { animalId: string; input: VaccinationInput; reminder: { title: string; body: string } }) => {
      const { given, date, ...rest } = a.input;
      const notification_id = given ? null : await scheduleReminder({ date, ...a.reminder, route: `/livestock/animals/${a.animalId}`, category: 'vaccination' });
      try {
        await must(supabase.from('vaccination_records').insert({
          animal_id: a.animalId, ...blankToNull(rest), status: given ? 'completed' : 'scheduled',
          given_on: given ? date : null, due_on: given ? null : date, notification_id,
        }));
      } catch (e) { await cancelReminders([notification_id]); throw e; }
    },
    onSuccess: () => invalidate('vaccinations', 'livestockSummary'),
  });

export const useCompleteVaccination = () =>
  useMutation({
    mutationFn: async (v: Pick<Vaccination, 'id' | 'notification_id'>) => {
      await must(supabase.from('vaccination_records').update({ status: 'completed', given_on: today() }).eq('id', v.id));
      await cancelReminders([v.notification_id]);
    },
    onSuccess: () => invalidate('vaccinations', 'livestockSummary'),
  });
