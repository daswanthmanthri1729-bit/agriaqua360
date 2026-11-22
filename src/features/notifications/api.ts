import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { must, queryClient } from '@/lib/query';
import type { IconName } from '@/components';

export type AppNotification = {
  id: string; category: string; title: string; body: string | null; route: string | null; priority: 'low' | 'normal' | 'high';
  scheduled_for: string | null; read_at: string | null; created_at: string;
};

export const CATEGORY_ICON: Record<string, IconName> = {
  weather: 'thunderstorm', crop: 'eco', irrigation: 'water-drop', farm: 'agriculture', pond: 'water', vaccination: 'vaccines',
  animal_health: 'pets', ai: 'auto-awesome', system: 'info-outline',
};

const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

// Only notifications that are due: future reminders stay hidden until their time.
export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      must<AppNotification[]>(supabase.from('notifications').select('*').or(`scheduled_for.is.null,scheduled_for.lte.${new Date().toISOString()}`).order('created_at', { ascending: false }).limit(100)),
  });

export const useNotification = (id: string) =>
  useQuery({ queryKey: ['notifications', id], queryFn: () => must<AppNotification>(supabase.from('notifications').select('*').eq('id', id).single()) });

export const useMarkRead = () =>
  useMutation({ mutationFn: (ids: string[]) => must(supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids).is('read_at', null)), onSuccess: refresh });

export const useDeleteNotification = () =>
  useMutation({ mutationFn: (id: string) => must(supabase.from('notifications').delete().eq('id', id)), onSuccess: refresh });
