-- AgriAqua 360 · initial schema
-- Ownership model: every row carries owner_id = auth.uid(); farm-scoped rows are also readable by farm_members.

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- 1. profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (char_length(full_name) <= 80),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  preferred_language text not null default 'en' check (preferred_language in ('en','te','hi')),
  sectors text[] not null default '{agriculture}' check (sectors <@ array['agriculture','aquaculture','livestock']::text[]),
  village text, district text, state text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  land_acres numeric(10,2) check (land_acres >= 0),
  experience_years int check (experience_years between 0 and 80),
  avatar_path text,
  push_token text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Creates the profile from sign-up metadata. Metadata is user-controlled, so every field is validated/whitelisted.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  lang text := meta->>'preferred_language';
  ph text := coalesce(new.phone, meta->>'phone');
  secs text[];
begin
  if lang is null or lang not in ('en','te','hi') then lang := 'en'; end if;
  if ph is not null and ph !~ '^\+?[1-9][0-9]{7,14}$' then ph := null; end if;
  if ph is not null and left(ph,1) <> '+' then ph := '+' || ph; end if;
  select coalesce(array_agg(s), '{agriculture}') into secs
    from jsonb_array_elements_text(case when jsonb_typeof(meta->'sectors') = 'array' then meta->'sectors' else '[]'::jsonb end) s
    where s in ('agriculture','aquaculture','livestock');
  if secs = '{}' then secs := '{agriculture}'; end if;
  insert into public.profiles (id, full_name, phone, email, preferred_language, sectors)
  values (new.id, left(meta->>'full_name', 80), ph, new.email, lang, secs);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2-3. farms + members ----------
create table public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  farm_type text not null default 'agriculture' check (farm_type in ('agriculture','aquaculture','livestock','mixed')),
  area_acres numeric(10,2) check (area_acres >= 0),
  soil_type text,
  irrigation_source text,
  village text, district text, state text,
  latitude double precision, longitude double precision,
  photo_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index farms_owner_idx on public.farms(owner_id);

create table public.farm_members (
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'viewer' check (role in ('manager','worker','viewer')),
  created_at timestamptz not null default now(),
  primary key (farm_id, user_id)
);
create index farm_members_user_idx on public.farm_members(user_id);

-- security definer avoids RLS recursion between farms <-> farm_members
create or replace function public.can_access_farm(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from farms where id = f and owner_id = auth.uid())
      or exists (select 1 from farm_members where farm_id = f and user_id = auth.uid());
$$;

-- ---------- 4-8. agriculture ----------
create table public.crops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  variety text,
  season text check (season in ('kharif','rabi','zaid','perennial')),
  area_acres numeric(10,2) check (area_acres >= 0),
  sowing_date date,
  expected_harvest_date date,
  status text not null default 'growing' check (status in ('planned','growing','harvested','failed')),
  photo_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_harvest_date is null or sowing_date is null or expected_harvest_date >= sowing_date)
);
create index crops_owner_idx on public.crops(owner_id);
create index crops_farm_idx on public.crops(farm_id);

create table public.crop_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  crop_id uuid not null references public.crops(id) on delete cascade,
  activity text not null check (activity in ('sowing','irrigation','fertilizer','pesticide','weeding','harvest','observation','other')),
  scheduled_for date,
  completed_at timestamptz,
  quantity numeric(12,2), unit text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index crop_records_crop_idx on public.crop_records(crop_id, scheduled_for);
create index crop_records_owner_idx on public.crop_records(owner_id);

create table public.crop_scans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  crop_id uuid references public.crops(id) on delete set null,
  image_paths text[] not null check (cardinality(image_paths) between 1 and 5),
  scan_type text not null default 'disease' check (scan_type in ('disease','pest','condition')),
  status text not null default 'pending' check (status in ('pending','completed','failed')),
  language text not null default 'en' check (language in ('en','te','hi')),
  created_at timestamptz not null default now()
);
create index crop_scans_owner_idx on public.crop_scans(owner_id, created_at desc);

create table public.disease_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  scan_id uuid not null references public.crop_scans(id) on delete cascade,
  condition_name text,
  confidence text check (confidence in ('low','medium','high')),
  severity text check (severity in ('none','mild','moderate','severe')),
  summary text,
  symptoms text[],
  recommend_expert boolean not null default false,
  raw_response jsonb,
  created_at timestamptz not null default now()
);
create index disease_reports_scan_idx on public.disease_reports(scan_id);
create index disease_reports_owner_idx on public.disease_reports(owner_id);

create table public.treatment_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  disease_report_id uuid references public.disease_reports(id) on delete set null,
  crop_id uuid references public.crops(id) on delete cascade,
  treatment_type text check (treatment_type in ('organic','chemical','cultural','biological')),
  description text not null,
  applied_on date,
  follow_up_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index treatment_records_owner_idx on public.treatment_records(owner_id);
create index treatment_records_crop_idx on public.treatment_records(crop_id);

-- ---------- 9-12. aquaculture ----------
create table public.ponds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  species text,
  area_acres numeric(10,2) check (area_acres >= 0),
  depth_m numeric(5,2) check (depth_m >= 0),
  stocking_date date,
  stocking_count int check (stocking_count >= 0),
  status text not null default 'active' check (status in ('preparing','active','harvested','idle')),
  latitude double precision, longitude double precision,
  photo_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ponds_owner_idx on public.ponds(owner_id);

-- Values are farmer-entered meter readings; the app never estimates them from photos.
create table public.water_quality_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  pond_id uuid not null references public.ponds(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  ph numeric(4,2) check (ph between 0 and 14),
  dissolved_oxygen_mgl numeric(5,2) check (dissolved_oxygen_mgl >= 0),
  temperature_c numeric(5,2) check (temperature_c between -5 and 50),
  ammonia_mgl numeric(6,3) check (ammonia_mgl >= 0),
  salinity_ppt numeric(5,2) check (salinity_ppt >= 0),
  turbidity_cm numeric(6,2) check (turbidity_cm >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create index wq_pond_idx on public.water_quality_records(pond_id, recorded_at desc);
create index wq_owner_idx on public.water_quality_records(owner_id);

create table public.fish_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  pond_id uuid not null references public.ponds(id) on delete cascade,
  record_type text not null check (record_type in ('stocking','feeding','sampling','mortality','harvest','treatment')),
  recorded_on date not null default current_date,
  quantity numeric(12,2), unit text,
  avg_weight_g numeric(8,2) check (avg_weight_g >= 0),
  notes text,
  created_at timestamptz not null default now()
);
create index fish_records_pond_idx on public.fish_records(pond_id, recorded_on desc);
create index fish_records_owner_idx on public.fish_records(owner_id);

create table public.fish_health_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  pond_id uuid references public.ponds(id) on delete set null,
  image_paths text[] not null default '{}',
  observations text,
  condition_name text,
  confidence text check (confidence in ('low','medium','high')),
  severity text check (severity in ('none','mild','moderate','severe')),
  summary text,
  recommend_expert boolean not null default false,
  raw_response jsonb,
  created_at timestamptz not null default now()
);
create index fish_health_owner_idx on public.fish_health_reports(owner_id, created_at desc);

-- ---------- 13-15. livestock ----------
create table public.livestock (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  species text not null check (species in ('cow','buffalo','sheep','goat','pig')),
  tag_id text,
  name text,
  breed text,
  sex text check (sex in ('male','female')),
  birth_date date,
  weight_kg numeric(7,2) check (weight_kg >= 0),
  status text not null default 'healthy' check (status in ('healthy','sick','under_treatment','pregnant','sold','deceased')),
  photo_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, tag_id)
);
create index livestock_owner_idx on public.livestock(owner_id, species);

create table public.animal_health_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  animal_id uuid not null references public.livestock(id) on delete cascade,
  record_type text not null check (record_type in ('checkup','illness','treatment','deworming','injury','ai_assessment')),
  recorded_on date not null default current_date,
  description text,
  vet_name text,
  image_paths text[] not null default '{}',
  follow_up_on date,
  created_at timestamptz not null default now()
);
create index ahr_animal_idx on public.animal_health_records(animal_id, recorded_on desc);
create index ahr_owner_idx on public.animal_health_records(owner_id);

create table public.vaccination_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  animal_id uuid not null references public.livestock(id) on delete cascade,
  vaccine_name text not null,
  dose text,
  given_on date,
  due_on date,
  status text not null default 'scheduled' check (status in ('scheduled','completed','missed')),
  notes text,
  created_at timestamptz not null default now(),
  check (given_on is not null or due_on is not null)
);
create index vacc_animal_idx on public.vaccination_records(animal_id);
create index vacc_due_idx on public.vaccination_records(owner_id, due_on) where status = 'scheduled';

-- ---------- 16-17. AI ----------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text,
  topic text check (topic in ('general','crop','pest','fertilizer','irrigation','aquaculture','fish_health','pond','livestock','animal_health')),
  language text not null default 'en' check (language in ('en','te','hi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conv_owner_idx on public.ai_conversations(owner_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  input_mode text not null default 'text' check (input_mode in ('text','voice','image')),
  image_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index ai_msg_conv_idx on public.ai_messages(conversation_id, created_at);

-- ---------- 18-21. shared ----------
create table public.uploaded_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  bucket text not null check (bucket in ('avatars','media')),
  path text not null,
  entity_type text check (entity_type in ('profile','farm','crop','crop_scan','pond','fish_health','animal','animal_health','ai_message')),
  entity_id uuid,
  mime_type text,
  size_bytes bigint check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  unique (bucket, path),
  check (split_part(path, '/', 1) = owner_id::text)
);
create index media_entity_idx on public.uploaded_media(entity_type, entity_id);
create index media_owner_idx on public.uploaded_media(owner_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  category text not null check (category in ('weather','crop','irrigation','farm','pond','vaccination','animal_health','ai','system')),
  title text not null,
  body text,
  route text check (route is null or route ~ '^/[A-Za-z0-9/_\-\[\]?=&.]*$'),
  data jsonb not null default '{}',
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  scheduled_for timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notif_owner_idx on public.notifications(owner_id, created_at desc);
create index notif_unread_idx on public.notifications(owner_id) where read_at is null;

create table public.saved_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  record_type text not null check (record_type in ('crop_scan','disease_report','fish_health_report','animal_health_record','ai_message','water_quality_record','treatment_record')),
  record_id uuid not null,
  title text,
  note text,
  created_at timestamptz not null default now(),
  unique (owner_id, record_type, record_id)
);
create index saved_owner_idx on public.saved_records(owner_id, created_at desc);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_owner_idx on public.activity_logs(owner_id, created_at desc);

-- ---------- updated_at triggers ----------
do $$ declare t text; begin
  foreach t in array array['profiles','farms','crops','crop_records','treatment_records','ponds','livestock','ai_conversations'] loop
    execute format('create trigger %I_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
create policy "profiles: read own" on public.profiles for select using (id = auth.uid());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

alter table public.farms enable row level security;
create policy "farms: members read" on public.farms for select using (public.can_access_farm(id));
create policy "farms: owner insert" on public.farms for insert with check (owner_id = auth.uid());
create policy "farms: owner update" on public.farms for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "farms: owner delete" on public.farms for delete using (owner_id = auth.uid());

alter table public.farm_members enable row level security;
create policy "farm_members: read" on public.farm_members for select using (user_id = auth.uid() or public.can_access_farm(farm_id));
create policy "farm_members: owner manage" on public.farm_members for all
  using (exists (select 1 from public.farms f where f.id = farm_id and f.owner_id = auth.uid()))
  with check (exists (select 1 from public.farms f where f.id = farm_id and f.owner_id = auth.uid()));

-- Crops: farm members can read; only the owner writes, and only into a farm they own.
alter table public.crops enable row level security;
create policy "crops: read" on public.crops for select using (owner_id = auth.uid() or public.can_access_farm(farm_id));
create policy "crops: insert" on public.crops for insert with check (owner_id = auth.uid() and exists (select 1 from public.farms f where f.id = farm_id and f.owner_id = auth.uid()));
create policy "crops: update" on public.crops for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "crops: delete" on public.crops for delete using (owner_id = auth.uid());

-- Owner-only tables: full CRUD on own rows. Parent references are verified on insert/update.
do $$ declare r record; begin
  for r in select * from (values
    ('crop_records', 'exists (select 1 from public.crops p where p.id = crop_id and p.owner_id = auth.uid())'),
    ('crop_scans', 'crop_id is null or exists (select 1 from public.crops p where p.id = crop_id and p.owner_id = auth.uid())'),
    ('disease_reports', 'exists (select 1 from public.crop_scans p where p.id = scan_id and p.owner_id = auth.uid())'),
    ('treatment_records', 'crop_id is null or exists (select 1 from public.crops p where p.id = crop_id and p.owner_id = auth.uid())'),
    ('ponds', 'farm_id is null or exists (select 1 from public.farms p where p.id = farm_id and p.owner_id = auth.uid())'),
    ('water_quality_records', 'exists (select 1 from public.ponds p where p.id = pond_id and p.owner_id = auth.uid())'),
    ('fish_records', 'exists (select 1 from public.ponds p where p.id = pond_id and p.owner_id = auth.uid())'),
    ('fish_health_reports', 'pond_id is null or exists (select 1 from public.ponds p where p.id = pond_id and p.owner_id = auth.uid())'),
    ('livestock', 'farm_id is null or exists (select 1 from public.farms p where p.id = farm_id and p.owner_id = auth.uid())'),
    ('animal_health_records', 'exists (select 1 from public.livestock p where p.id = animal_id and p.owner_id = auth.uid())'),
    ('vaccination_records', 'exists (select 1 from public.livestock p where p.id = animal_id and p.owner_id = auth.uid())'),
    ('ai_conversations', 'true'),
    ('ai_messages', 'exists (select 1 from public.ai_conversations p where p.id = conversation_id and p.owner_id = auth.uid())'),
    ('uploaded_media', 'true'),
    ('notifications', 'true'),
    ('saved_records', 'true'),
    ('activity_logs', 'true')
  ) as v(tbl, parent_check) loop
    execute format('alter table public.%I enable row level security', r.tbl);
    execute format('create policy "%s: read own" on public.%I for select using (owner_id = auth.uid())', r.tbl, r.tbl);
    execute format('create policy "%s: insert own" on public.%I for insert with check (owner_id = auth.uid() and (%s))', r.tbl, r.tbl, r.parent_check);
    execute format('create policy "%s: update own" on public.%I for update using (owner_id = auth.uid()) with check (owner_id = auth.uid() and (%s))', r.tbl, r.tbl, r.parent_check);
    execute format('create policy "%s: delete own" on public.%I for delete using (owner_id = auth.uid())', r.tbl, r.tbl);
  end loop;
end $$;

-- Activity logs are append-only for clients.
drop policy "activity_logs: update own" on public.activity_logs;
drop policy "activity_logs: delete own" on public.activity_logs;

-- ---------- Storage (private buckets, path = <uid>/<folder>/<file>) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('media', 'media', false, 10485760, array['image/jpeg','image/png','image/webp','audio/mp4','audio/m4a','audio/aac','audio/mpeg','audio/webm'])
on conflict (id) do nothing;

create policy "storage: read own" on storage.objects for select
  using (bucket_id in ('avatars','media') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: upload own" on storage.objects for insert
  with check (bucket_id in ('avatars','media') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: update own" on storage.objects for update
  using (bucket_id in ('avatars','media') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "storage: delete own" on storage.objects for delete
  using (bucket_id in ('avatars','media') and (storage.foldername(name))[1] = auth.uid()::text);
