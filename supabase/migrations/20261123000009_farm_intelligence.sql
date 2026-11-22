-- Level 2: soil tests, satellite NDVI, market prices, harvest outlook, livestock production records,
-- fish record details, farm boundaries, government schemes, farm costs/income, user preferences.
-- Additive only. Existing tables are reused where they already fit:
--   irrigation + crop harvests -> crop_records (activity 'irrigation' / 'harvest')
--   stocking/feeding/growth/mortality/fish harvest -> fish_records
--   API caches (weather, NASA POWER, SoilGrids) -> weather_cache (server only)

-- ---------- Existing tables: new columns ----------
alter table public.farms
  add column boundary jsonb check (boundary is null or (jsonb_typeof(boundary) = 'array' and jsonb_array_length(boundary) between 3 and 500)), -- [[lon,lat],...]
  add column boundary_area_ha numeric(10,3) check (boundary_area_ha >= 0);

alter table public.crops
  add column growth_stage text check (growth_stage in ('germination','vegetative','flowering','fruiting','maturity','harvest'));

alter table public.fish_records
  add column count int check (count >= 0),
  add column cause text check (cause in ('disease','low_oxygen','water_quality','predator','handling','unknown','other')),
  add column feed_type text check (char_length(feed_type) <= 60),
  add column avg_length_cm numeric(6,2) check (avg_length_cm >= 0);

alter table public.notifications drop constraint notifications_category_check;
alter table public.notifications add constraint notifications_category_check check (category in
  ('weather','crop','irrigation','farm','pond','vaccination','animal_health','ai','system',
   'sensor','device','market','harvest','scheme','finance','location'));

alter table public.uploaded_media drop constraint uploaded_media_entity_type_check;
alter table public.uploaded_media add constraint uploaded_media_entity_type_check check (entity_type in
  ('profile','farm','crop','crop_scan','pond','fish_health','animal','animal_health','ai_message',
   'soil_test','transaction','fish_record','satellite'));

-- ---------- Soil ----------
create table public.soil_tests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  tested_on date not null,
  source text not null default 'lab' check (source in ('lab','soil_health_card','field_kit')),
  lab_name text check (char_length(lab_name) <= 80),
  sample_depth_cm int check (sample_depth_cm between 0 and 200),
  ph numeric(4,2) check (ph between 0 and 14),
  ec_dsm numeric(6,3) check (ec_dsm >= 0),
  organic_carbon_pct numeric(5,2) check (organic_carbon_pct between 0 and 100),
  nitrogen_kg_ha numeric(8,2) check (nitrogen_kg_ha >= 0),
  phosphorus_kg_ha numeric(8,2) check (phosphorus_kg_ha >= 0),
  potassium_kg_ha numeric(8,2) check (potassium_kg_ha >= 0),
  sulphur_ppm numeric(8,2) check (sulphur_ppm >= 0),
  zinc_ppm numeric(8,3) check (zinc_ppm >= 0),
  iron_ppm numeric(8,3) check (iron_ppm >= 0),
  report_path text,
  notes text,
  created_at timestamptz not null default now()
);
create index soil_tests_farm_idx on public.soil_tests(farm_id, tested_on desc);

-- ---------- Satellite (written by the satellite function only) ----------
create table public.satellite_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  provider text not null,            -- e.g. 'Copernicus Sentinel-2 L2A'
  scene_id text not null,
  acquired_at timestamptz not null,
  cloud_pct numeric(5,2),
  resolution_m numeric(6,2) not null,
  valid_pixel_pct numeric(5,2),
  ndvi_mean numeric(5,3), ndvi_min numeric(5,3), ndvi_max numeric(5,3),
  stress_pct numeric(5,2),           -- share of valid pixels with NDVI below 0.3
  fetched_at timestamptz not null default now(),
  unique (farm_id, scene_id)
);
create index satellite_farm_idx on public.satellite_observations(farm_id, acquired_at desc);

-- ---------- Market prices (shared reference data from AGMARKNET via data.gov.in) ----------
create table public.market_prices (
  id bigint generated always as identity primary key,
  state text not null, district text not null, market text not null,
  commodity text not null, variety text not null default '', grade text not null default '',
  arrival_date date not null,
  min_price numeric(10,2) check (min_price >= 0),
  max_price numeric(10,2) check (max_price >= 0),
  modal_price numeric(10,2) check (modal_price >= 0),   -- ₹ per quintal
  source text not null default 'agmarknet',
  fetched_at timestamptz not null default now(),
  unique (state, district, market, commodity, variety, grade, arrival_date)
);
create index market_prices_commodity_idx on public.market_prices(commodity, state, arrival_date desc);
create index market_prices_market_idx on public.market_prices(market, arrival_date desc);

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  commodity text not null check (char_length(commodity) between 1 and 80),
  state text, market text,
  direction text not null check (direction in ('above','below')),
  price numeric(10,2) not null check (price > 0),
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);
create index price_alerts_owner_idx on public.price_alerts(owner_id);

create table public.harvest_forecasts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  crop_id uuid references public.crops(id) on delete cascade,
  pond_id uuid references public.ponds(id) on delete cascade,
  commodity text not null,
  harvest_from date, harvest_to date,
  yield_low numeric(12,2), yield_high numeric(12,2), yield_unit text,
  price_low numeric(10,2), price_mid numeric(10,2), price_high numeric(10,2),  -- ₹/quintal, a range, never one number
  basis jsonb not null default '{}',  -- what the estimate used: years of history, sample sizes, factors
  method text not null check (method in ('historical_seasonal','ai_estimate')),
  generated_at timestamptz not null default now(),
  check (num_nonnulls(crop_id, pond_id) <= 1)
);
create index harvest_forecasts_owner_idx on public.harvest_forecasts(owner_id, generated_at desc);

-- ---------- Livestock production ----------
create table public.animal_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  animal_id uuid not null references public.livestock(id) on delete cascade,
  record_type text not null check (record_type in ('weight','milk','feeding','heat','insemination','pregnancy_check','birth','dry_off')),
  recorded_on date not null default current_date,
  value numeric(10,2) check (value >= 0),   -- kg for weight/feeding, litres for milk
  session text check (session in ('morning','evening')),
  detail text check (char_length(detail) <= 200),   -- feed name, bull/semen, result, etc.
  due_on date,                                     -- e.g. expected calving date
  notes text,
  created_at timestamptz not null default now(),
  check (record_type not in ('weight','milk','feeding') or value is not null)
);
create index animal_records_animal_idx on public.animal_records(animal_id, record_type, recorded_on desc);

-- ---------- Government schemes (shared reference list, maintained in migrations) ----------
create table public.schemes (
  code text primary key,
  level text not null check (level in ('central','state')),
  state text,
  sectors text[] not null check (sectors <@ array['agriculture','aquaculture','livestock']::text[]),
  name jsonb not null,       -- {en, te, hi}
  summary jsonb not null,    -- {en, te, hi}
  rules jsonb not null default '{}',   -- {requires_land, max_land_acres, ...} used by the eligibility check
  official_url text not null check (official_url ~ '^https://'),
  info_as_of date not null,  -- shown to users: details may have changed since
  active boolean not null default true
);

create table public.scheme_tracking (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  scheme_code text not null references public.schemes(code) on delete cascade,
  status text not null default 'interested' check (status in ('interested','applied','approved','rejected')),
  applied_on date,
  reference_no text check (char_length(reference_no) <= 60),
  notes text,
  updated_at timestamptz not null default now(),
  unique (owner_id, scheme_code)
);
create trigger scheme_tracking_updated before update on public.scheme_tracking for each row execute function public.set_updated_at();

-- ---------- Farm costs and income (bookkeeping only; no buying or selling in the app) ----------
create table public.farm_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('expense','income')),
  category text not null check (category in (
    'seed','fertilizer','pesticide','feed','labour','fuel','electricity','water','equipment','veterinary','transport','rent','loan_interest','other_expense',
    'crop_sale','fish_sale','milk_sale','animal_sale','subsidy','insurance_claim','other_income')),
  amount numeric(12,2) not null check (amount > 0 and amount < 100000000),
  occurred_on date not null default current_date,
  farm_id uuid references public.farms(id) on delete set null,
  crop_id uuid references public.crops(id) on delete set null,
  pond_id uuid references public.ponds(id) on delete set null,
  animal_id uuid references public.livestock(id) on delete set null,
  quantity numeric(12,2) check (quantity >= 0), unit text check (char_length(unit) <= 20),
  notes text check (char_length(notes) <= 300),
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'expense') = (category in ('seed','fertilizer','pesticide','feed','labour','fuel','electricity','water','equipment','veterinary','transport','rent','loan_interest','other_expense')))
);
create index farm_tx_owner_idx on public.farm_transactions(owner_id, occurred_on desc);
create trigger farm_transactions_updated before update on public.farm_transactions for each row execute function public.set_updated_at();

-- ---------- Preferences ----------
create table public.user_preferences (
  owner_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  notify jsonb not null default '{}',   -- {category: false} turns a category off; missing = on
  quiet_from time, quiet_to time,
  updated_at timestamptz not null default now()
);
create trigger user_preferences_updated before update on public.user_preferences for each row execute function public.set_updated_at();

-- ---------- Row Level Security ----------
do $$ declare r record; begin
  for r in select * from (values
    ('soil_tests', 'exists (select 1 from public.farms p where p.id = farm_id and p.owner_id = auth.uid())'),
    ('price_alerts', 'true'),
    ('harvest_forecasts', '(crop_id is null or exists (select 1 from public.crops p where p.id = crop_id and p.owner_id = auth.uid())) and (pond_id is null or exists (select 1 from public.ponds p where p.id = pond_id and p.owner_id = auth.uid()))'),
    ('animal_records', 'exists (select 1 from public.livestock p where p.id = animal_id and p.owner_id = auth.uid())'),
    ('scheme_tracking', 'true'),
    ('farm_transactions', '(farm_id is null or exists (select 1 from public.farms p where p.id = farm_id and p.owner_id = auth.uid())) and (crop_id is null or exists (select 1 from public.crops p where p.id = crop_id and p.owner_id = auth.uid())) and (pond_id is null or exists (select 1 from public.ponds p where p.id = pond_id and p.owner_id = auth.uid())) and (animal_id is null or exists (select 1 from public.livestock p where p.id = animal_id and p.owner_id = auth.uid()))'),
    ('user_preferences', 'true')
  ) as v(tbl, parent_check) loop
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format('create policy "%s: read own" on public.%I for select using (owner_id = auth.uid())', r.tbl, r.tbl);
    execute format('create policy "%s: insert own" on public.%I for insert with check (owner_id = auth.uid() and (%s))', r.tbl, r.tbl, r.parent_check);
    execute format('create policy "%s: update own" on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid() and (%s))', r.tbl, r.tbl, r.parent_check);
    execute format('create policy "%s: delete own" on public.%I for delete using (owner_id = auth.uid())', r.tbl, r.tbl);
  end loop;
end $$;
revoke update on public.price_alerts from authenticated, anon;   -- last_triggered_at is set by the server
grant update (commodity, state, market, direction, price, enabled) on public.price_alerts to authenticated;

alter table public.satellite_observations enable row level security;
create policy "satellite: read own" on public.satellite_observations for select using (owner_id = auth.uid());
create policy "satellite: delete own" on public.satellite_observations for delete using (owner_id = auth.uid());
revoke insert, update on public.satellite_observations from authenticated, anon;

alter table public.market_prices enable row level security;
create policy "market_prices: read" on public.market_prices for select to authenticated using (true);
revoke insert, update, delete on public.market_prices from authenticated, anon;

alter table public.schemes enable row level security;
create policy "schemes: read" on public.schemes for select to authenticated using (active);
revoke insert, update, delete on public.schemes from authenticated, anon;

-- ---------- Helpers ----------
-- Income, expense and profit for a period, overall and per crop / pond / animal.
create or replace function public.finance_summary(p_from date, p_to date)
returns table (scope text, scope_id uuid, income numeric, expense numeric, profit numeric)
language sql stable security invoker set search_path = public as $$
  with t as (
    select kind, amount,
           case when crop_id is not null then 'crop' when pond_id is not null then 'pond'
                when animal_id is not null then 'animal' when farm_id is not null then 'farm' else 'general' end as scope,
           coalesce(crop_id, pond_id, animal_id, farm_id) as scope_id
    from public.farm_transactions
    where owner_id = auth.uid() and occurred_on between p_from and p_to
  )
  select coalesce(scope, 'total'), scope_id,
         coalesce(sum(amount) filter (where kind = 'income'), 0),
         coalesce(sum(amount) filter (where kind = 'expense'), 0),
         coalesce(sum(amount) filter (where kind = 'income'), 0) - coalesce(sum(amount) filter (where kind = 'expense'), 0)
  from t
  group by grouping sets ((scope, scope_id), ())
  order by (scope is not null), scope, scope_id;
$$;

-- Same-month price statistics over past years, for the harvest-time outlook.
create or replace function public.seasonal_prices(p_commodity text, p_state text default null, p_months int[] default null)
returns table (yr int, mon int, modal_avg numeric, modal_min numeric, modal_max numeric, n int)
language sql stable security invoker set search_path = public as $$
  select extract(year from arrival_date)::int, extract(month from arrival_date)::int,
         round(avg(modal_price), 2), min(modal_price), max(modal_price), count(*)::int
  from public.market_prices
  where commodity = p_commodity and (p_state is null or state = p_state)
    and (p_months is null or extract(month from arrival_date)::int = any(p_months))
    and modal_price > 0
  group by 1, 2 order by 1, 2;
$$;

alter publication supabase_realtime add table public.satellite_observations;
