import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';
import { persister, queryClient } from '@/lib/query';
import { registerPushToken } from '@/services/notifications';
import type { Profile } from '@/types/database';

type State = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  init: () => () => void;
  refreshProfile: () => Promise<Profile | null>;
};

export const useSession = create<State>()((set, get) => ({
  ready: false,
  session: null,
  profile: null,
  init: () => {
    if (!isSupabaseConfigured) {
      set({ ready: true });
      return () => {};
    }
    supabase.auth.getSession().then(async ({ data }) => {
      set({ session: data.session });
      if (data.session) await get().refreshProfile();
      set({ ready: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      // Next farmer on a shared phone must not see the previous farmer's cached data.
      if (!session) { set({ profile: null }); queryClient.clear(); persister.removeClient(); }
      // Defer DB calls out of the auth callback (supabase-js deadlock guidance).
      else setTimeout(() => { get().refreshProfile(); registerPushToken(session.user.id); }, 0);
    });
    return () => data.subscription.unsubscribe();
  },
  refreshProfile: async () => {
    const id = get().session?.user.id;
    if (!id) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    set({ profile: (data as Profile | null) ?? null });
    return (data as Profile | null) ?? null;
  },
}));
