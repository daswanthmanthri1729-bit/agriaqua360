import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { env, isSupabaseConfigured } from './env';

// Placeholder URL keeps the app bootable when .env is missing; screens show a "server not configured" banner instead.
export const supabase = createClient(
  isSupabaseConfigured ? env.supabaseUrl : 'https://not-configured.supabase.co',
  env.supabaseKey || 'missing-key',
  {
    auth: {
      storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Supabase recommends pausing token refresh while the app is backgrounded.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) =>
    s === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh(),
  );
}
