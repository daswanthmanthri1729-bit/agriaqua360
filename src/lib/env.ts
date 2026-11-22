export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
};
export const isSupabaseConfigured = /^https:\/\//.test(env.supabaseUrl) && env.supabaseKey.length > 0;
