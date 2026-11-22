import AsyncStorage from '@react-native-async-storage/async-storage';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { addNetworkStateListener } from 'expo-network';
import Constants from 'expo-constants';
import { supabase } from './supabase';

const DAY = 24 * 3600_000;
// gcTime ≥ persist maxAge, otherwise persisted data is dropped before it can be restored.
export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, gcTime: DAY } } });

// Last-loaded data survives restarts, so screens show something without signal (read-only offline).
export const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'agriaqua-query-cache', throttleTime: 2000 });
export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: DAY,
  buster: Constants.expoConfig?.version ?? '1', // new app version → drop old cache shapes
  dehydrateOptions: {
    // Signed photo URLs expire; never persist them.
    shouldDehydrateQuery: (q) => q.state.status === 'success' && q.queryKey[0] !== 'signed',
  },
};

// Pause queries while offline and refetch automatically when the connection returns.
onlineManager.setEventListener((setOnline) => {
  const sub = addNetworkStateListener((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false));
  return () => sub.remove();
});

// Unwraps a supabase-js result so TanStack Query sees errors as rejections.
export async function must<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

export async function userId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('errors.sessionExpired');
  return id;
}

// Edge Function call; server error codes become app translation keys.
export async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const code = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(code ? `errors.${code}` : 'errors.network');
  }
  return data as T;
}
