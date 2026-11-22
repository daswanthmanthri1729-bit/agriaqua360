-- Shared 30-minute forecast cache (same weather for everyone in a ~11 km cell).
-- RLS on with NO policies: only the weather Edge Function (service role) can read or write it,
-- so users cannot plant fake weather for other farmers.
create table public.weather_cache (
  cache_key text primary key check (char_length(cache_key) <= 120),
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.weather_cache enable row level security;
revoke all on public.weather_cache from anon, authenticated;
