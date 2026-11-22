-- Level 2: IoT devices, sensor readings, thresholds, alerts, equipment control, automation rules, livestock location.
-- Additive only: no existing table or column is dropped or renamed.

-- ---------- Sensor catalogue (shared, read-only for users) ----------
create table public.sensor_types (
  code text primary key,
  domain text not null check (domain in ('soil','air','water','animal','device')),
  unit text not null,
  min_valid numeric not null,   -- physically possible range; values outside are rejected as faulty
  max_valid numeric not null,
  check (min_valid < max_valid)
);
insert into public.sensor_types (code, domain, unit, min_valid, max_valid) values
  ('soil_moisture','soil','%',0,100),
  ('soil_temp','soil','°C',-10,70),
  ('soil_ph','soil','pH',0,14),
  ('soil_n','soil','mg/kg',0,2000),
  ('soil_p','soil','mg/kg',0,2000),
  ('soil_k','soil','mg/kg',0,2000),
  ('air_temp','air','°C',-20,60),
  ('air_humidity','air','%',0,100),
  ('light','air','lux',0,200000),
  ('rainfall','air','mm',0,500),
  ('water_flow','water','L',0,100000),
  ('water_do','water','mg/L',0,30),
  ('water_temp','water','°C',-5,50),
  ('water_ph','water','pH',0,14),
  ('turbidity','water','NTU',0,4000),
  ('ammonia','water','mg/L',0,100),
  ('water_level','water','cm',0,1000),
  ('salinity','water','ppt',0,70),
  ('body_temp','animal','°C',30,45),
  ('activity','animal','steps/h',0,20000),
  ('rumination','animal','min/h',0,60),
  ('battery','device','%',0,100);

-- ---------- Devices ----------
create table public.sensor_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  pond_id uuid references public.ponds(id) on delete set null,
  animal_id uuid references public.livestock(id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null check (kind in ('field_node','pond_node','gateway','controller','collar')),
  hardware text not null default 'esp32' check (char_length(hardware) <= 40),
  is_simulated boolean not null default false,   -- fixed at registration; simulated data is always labelled
  transport text not null default 'https' check (transport in ('https','mqtt')),
  reporting_interval_s int not null default 300 check (reporting_interval_s between 10 and 86400),
  firmware text check (char_length(firmware) <= 40),
  battery_pct numeric(5,2) check (battery_pct between 0 and 100),
  rssi_dbm int check (rssi_dbm between -150 and 0),
  last_seen_at timestamptz,
  offline_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sensor_devices_owner_idx on public.sensor_devices(owner_id);
create index sensor_devices_pond_idx on public.sensor_devices(pond_id) where pond_id is not null;
create index sensor_devices_farm_idx on public.sensor_devices(farm_id) where farm_id is not null;
create index sensor_devices_seen_idx on public.sensor_devices(last_seen_at);
create trigger sensor_devices_updated before update on public.sensor_devices for each row execute function public.set_updated_at();

-- Secret key hashes live apart from the device row: no client policy, so only server functions can read them.
create table public.device_keys (
  device_id uuid primary key references public.sensor_devices(id) on delete cascade,
  key_hash text not null,          -- sha-256 hex of the device secret; the secret itself is never stored
  key_prefix text not null,        -- first characters, shown to the owner to tell keys apart
  rotated_at timestamptz not null default now()
);

-- What each device can actually measure (sensors) or switch (actuators). Readings for a parameter the
-- device has no enabled sensor channel for are rejected by the ingest function.
create table public.device_channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  device_id uuid not null references public.sensor_devices(id) on delete cascade,
  channel text not null check (channel ~ '^[a-z0-9_]{1,32}$'),
  kind text not null check (kind in ('sensor','actuator')),
  sensor_type text references public.sensor_types(code),
  actuator_type text check (actuator_type in ('pump','valve','aerator','feeder','other')),
  label text check (char_length(label) <= 60),
  enabled boolean not null default true,
  calibration_offset numeric not null default 0,
  calibration_scale numeric not null default 1 check (calibration_scale > 0),
  calibrated_at timestamptz,
  max_run_s int check (max_run_s between 10 and 14400),  -- device turns the actuator off after this, whatever happens
  state text check (state in ('on','off','unknown')),
  state_at timestamptz,
  manual_override boolean not null default false,          -- reported by the device when its local switch is in use
  created_at timestamptz not null default now(),
  unique (device_id, channel),
  check ((kind = 'sensor' and sensor_type is not null and actuator_type is null)
      or (kind = 'actuator' and actuator_type is not null and sensor_type is null and max_run_s is not null))
);
create index device_channels_device_idx on public.device_channels(device_id);

-- ---------- Readings ----------
create table public.sensor_readings (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  device_id uuid references public.sensor_devices(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  pond_id uuid references public.ponds(id) on delete cascade,
  animal_id uuid references public.livestock(id) on delete cascade,
  sensor_type text not null references public.sensor_types(code),
  value numeric not null,
  raw_value numeric,               -- before calibration
  source text not null check (source in ('sensor','simulated','manual','api','ai_estimate')),
  quality text not null default 'ok' check (quality in ('ok','suspect')),
  recorded_at timestamptz not null,
  received_at timestamptz not null default now(),
  check (recorded_at <= received_at + interval '10 minutes')
);
create unique index sensor_readings_dedupe on public.sensor_readings(device_id, sensor_type, recorded_at) where device_id is not null;
create index sensor_readings_device_idx on public.sensor_readings(device_id, sensor_type, recorded_at desc);
create index sensor_readings_pond_idx on public.sensor_readings(pond_id, sensor_type, recorded_at desc) where pond_id is not null;
create index sensor_readings_farm_idx on public.sensor_readings(farm_id, sensor_type, recorded_at desc) where farm_id is not null;
create index sensor_readings_animal_idx on public.sensor_readings(animal_id, sensor_type, recorded_at desc) where animal_id is not null;
create index sensor_readings_owner_idx on public.sensor_readings(owner_id, recorded_at desc);

-- Pond sensors also leave a water-quality snapshot so Level 1 screens, reports and the AI see them.
alter table public.water_quality_records
  add column source text not null default 'manual' check (source in ('manual','sensor','simulated')),
  add column device_id uuid references public.sensor_devices(id) on delete set null,
  add column water_level_cm numeric(7,2) check (water_level_cm >= 0),
  add column turbidity_ntu numeric(7,2) check (turbidity_ntu >= 0);

-- ---------- Thresholds and alerts ----------
create table public.sensor_thresholds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  device_id uuid references public.sensor_devices(id) on delete cascade,
  pond_id uuid references public.ponds(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  sensor_type text not null references public.sensor_types(code),
  min_value numeric,
  max_value numeric,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (min_value is not null or max_value is not null),
  check (min_value is null or max_value is null or min_value < max_value),
  check (num_nonnulls(device_id, pond_id, farm_id) = 1)
);
create unique index sensor_thresholds_scope on public.sensor_thresholds(owner_id, coalesce(device_id, pond_id, farm_id), sensor_type);
create trigger sensor_thresholds_updated before update on public.sensor_thresholds for each row execute function public.set_updated_at();

create table public.sensor_alerts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid references public.sensor_devices(id) on delete cascade,
  pond_id uuid references public.ponds(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  animal_id uuid references public.livestock(id) on delete cascade,
  sensor_type text references public.sensor_types(code),
  kind text not null check (kind in ('low','high','offline','battery','geofence','rejected')),
  value numeric,
  limit_value numeric,
  source text not null default 'sensor' check (source in ('sensor','simulated')),
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);
create index sensor_alerts_owner_idx on public.sensor_alerts(owner_id, created_at desc);
create index sensor_alerts_open_idx on public.sensor_alerts(owner_id) where status = 'open';
create unique index sensor_alerts_one_open on public.sensor_alerts(coalesce(device_id, pond_id, farm_id, animal_id), coalesce(sensor_type, ''), kind) where status = 'open';

-- ---------- Equipment control ----------
create table public.actuator_commands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  device_id uuid not null references public.sensor_devices(id) on delete cascade,
  channel text not null,
  action text not null check (action in ('on','off')),
  duration_s int check (duration_s between 10 and 14400),
  requested_by text not null default 'user' check (requested_by in ('user','rule')),
  rule_id uuid,
  status text not null default 'pending' check (status in ('pending','sent','done','failed','expired','cancelled','rejected')),
  result text check (char_length(result) <= 200),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 minutes',
  sent_at timestamptz,
  finished_at timestamptz,
  check (action = 'off' or duration_s is not null)
);
create index actuator_commands_device_idx on public.actuator_commands(device_id, status, created_at);
create index actuator_commands_owner_idx on public.actuator_commands(owner_id, created_at desc);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  enabled boolean not null default false,   -- every rule starts switched off
  sensor_device_id uuid not null references public.sensor_devices(id) on delete cascade,
  sensor_type text not null references public.sensor_types(code),
  operator text not null check (operator in ('<','>')),
  threshold numeric not null,
  target_device_id uuid not null references public.sensor_devices(id) on delete cascade,
  target_channel text not null,
  action text not null check (action in ('on','off')),
  duration_s int check (duration_s between 10 and 14400),
  cooldown_min int not null default 30 check (cooldown_min between 5 and 1440),
  last_fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (action = 'off' or duration_s is not null)
);
create index automation_rules_sensor_idx on public.automation_rules(sensor_device_id) where enabled;
create trigger automation_rules_updated before update on public.automation_rules for each row execute function public.set_updated_at();
alter table public.actuator_commands add constraint actuator_commands_rule_fk foreign key (rule_id) references public.automation_rules(id) on delete set null;

-- ---------- Livestock location ----------
create table public.geofences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  polygon jsonb not null check (jsonb_typeof(polygon) = 'array' and jsonb_array_length(polygon) between 3 and 200), -- [[lon,lat],...]
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index geofences_owner_idx on public.geofences(owner_id);

create table public.animal_locations (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  animal_id uuid not null references public.livestock(id) on delete cascade,
  device_id uuid references public.sensor_devices(id) on delete set null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m numeric(7,1) check (accuracy_m >= 0),
  source text not null check (source in ('sensor','simulated','manual')),
  recorded_at timestamptz not null default now()
);
create index animal_locations_animal_idx on public.animal_locations(animal_id, recorded_at desc);

-- ---------- Row Level Security ----------
alter table public.sensor_types enable row level security;
create policy "sensor_types: read" on public.sensor_types for select to authenticated using (true);

alter table public.device_keys enable row level security;   -- no policies: server only
revoke all on public.device_keys from authenticated, anon;

alter table public.sensor_devices enable row level security;
create policy "sensor_devices: read own" on public.sensor_devices for select using (owner_id = auth.uid());
create policy "sensor_devices: update own" on public.sensor_devices for update using (owner_id = auth.uid()) with check (
  owner_id = auth.uid()
  and (farm_id is null or exists (select 1 from public.farms p where p.id = farm_id and p.owner_id = auth.uid()))
  and (pond_id is null or exists (select 1 from public.ponds p where p.id = pond_id and p.owner_id = auth.uid()))
  and (animal_id is null or exists (select 1 from public.livestock p where p.id = animal_id and p.owner_id = auth.uid())));
create policy "sensor_devices: delete own" on public.sensor_devices for delete using (owner_id = auth.uid());
-- Registration goes through the `devices` function (it also creates the key). Clients may only edit these columns:
revoke insert, update on public.sensor_devices from authenticated, anon;
grant update (name, farm_id, pond_id, animal_id, reporting_interval_s, transport) on public.sensor_devices to authenticated;

alter table public.device_channels enable row level security;
create policy "device_channels: read own" on public.device_channels for select using (owner_id = auth.uid());
create policy "device_channels: insert own" on public.device_channels for insert with check (owner_id = auth.uid() and exists (select 1 from public.sensor_devices d where d.id = device_id and d.owner_id = auth.uid()));
create policy "device_channels: update own" on public.device_channels for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "device_channels: delete own" on public.device_channels for delete using (owner_id = auth.uid());
revoke update on public.device_channels from authenticated, anon;   -- state/override are reported by the device only
grant update (label, enabled, calibration_offset, calibration_scale, calibrated_at, max_run_s) on public.device_channels to authenticated;

alter table public.sensor_readings enable row level security;
create policy "sensor_readings: read own" on public.sensor_readings for select using (owner_id = auth.uid());
-- Clients can only add manual readings; sensor and simulated readings come from the ingest function.
create policy "sensor_readings: insert manual" on public.sensor_readings for insert with check (
  owner_id = auth.uid() and source = 'manual' and device_id is null
  and (farm_id is null or exists (select 1 from public.farms p where p.id = farm_id and p.owner_id = auth.uid()))
  and (pond_id is null or exists (select 1 from public.ponds p where p.id = pond_id and p.owner_id = auth.uid()))
  and (animal_id is null or exists (select 1 from public.livestock p where p.id = animal_id and p.owner_id = auth.uid())));
create policy "sensor_readings: delete own manual" on public.sensor_readings for delete using (owner_id = auth.uid() and source = 'manual');
revoke update on public.sensor_readings from authenticated, anon;

-- Water-quality rows written by clients stay 'manual'.
drop policy "water_quality_records: insert own" on public.water_quality_records;
create policy "water_quality_records: insert own" on public.water_quality_records for insert with check (
  owner_id = auth.uid() and source = 'manual' and device_id is null
  and exists (select 1 from public.ponds p where p.id = pond_id and p.owner_id = auth.uid()));
drop policy "water_quality_records: update own" on public.water_quality_records;
create policy "water_quality_records: update own" on public.water_quality_records for update using (owner_id = auth.uid() and source = 'manual') with check (
  owner_id = auth.uid() and source = 'manual' and device_id is null
  and exists (select 1 from public.ponds p where p.id = pond_id and p.owner_id = auth.uid()));

alter table public.sensor_thresholds enable row level security;
create policy "sensor_thresholds: read own" on public.sensor_thresholds for select using (owner_id = auth.uid());
create policy "sensor_thresholds: write own" on public.sensor_thresholds for all using (owner_id = auth.uid()) with check (
  owner_id = auth.uid()
  and (device_id is null or exists (select 1 from public.sensor_devices p where p.id = device_id and p.owner_id = auth.uid()))
  and (pond_id is null or exists (select 1 from public.ponds p where p.id = pond_id and p.owner_id = auth.uid()))
  and (farm_id is null or exists (select 1 from public.farms p where p.id = farm_id and p.owner_id = auth.uid())));

alter table public.sensor_alerts enable row level security;
create policy "sensor_alerts: read own" on public.sensor_alerts for select using (owner_id = auth.uid());
create policy "sensor_alerts: update own" on public.sensor_alerts for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke insert, update on public.sensor_alerts from authenticated, anon;
grant update (status, acknowledged_at, resolved_at) on public.sensor_alerts to authenticated;

alter table public.actuator_commands enable row level security;
create policy "actuator_commands: read own" on public.actuator_commands for select using (owner_id = auth.uid());
-- A person can only queue a command for their own actuator channel, within that channel's maximum run time.
create policy "actuator_commands: insert own" on public.actuator_commands for insert with check (
  owner_id = auth.uid() and requested_by = 'user' and rule_id is null and status = 'pending'
  and exists (select 1 from public.device_channels c join public.sensor_devices d on d.id = c.device_id
              where c.device_id = actuator_commands.device_id and c.channel = actuator_commands.channel
                and c.kind = 'actuator' and c.enabled and d.owner_id = auth.uid()
                and (actuator_commands.duration_s is null or actuator_commands.duration_s <= c.max_run_s)));
create policy "actuator_commands: cancel own" on public.actuator_commands for update using (owner_id = auth.uid() and status = 'pending') with check (owner_id = auth.uid() and status = 'cancelled');
revoke update on public.actuator_commands from authenticated, anon;
grant update (status) on public.actuator_commands to authenticated;

alter table public.automation_rules enable row level security;
create policy "automation_rules: read own" on public.automation_rules for select using (owner_id = auth.uid());
create policy "automation_rules: write own" on public.automation_rules for all using (owner_id = auth.uid()) with check (
  owner_id = auth.uid()
  and exists (select 1 from public.sensor_devices p where p.id = sensor_device_id and p.owner_id = auth.uid())
  and exists (select 1 from public.device_channels c where c.device_id = target_device_id and c.channel = target_channel
              and c.kind = 'actuator' and c.owner_id = auth.uid() and (duration_s is null or duration_s <= c.max_run_s)));
revoke update on public.automation_rules from authenticated, anon;   -- last_fired_at is set by the server
grant update (name, enabled, sensor_device_id, sensor_type, operator, threshold, target_device_id, target_channel, action, duration_s, cooldown_min) on public.automation_rules to authenticated;

alter table public.geofences enable row level security;
create policy "geofences: own" on public.geofences for all using (owner_id = auth.uid()) with check (
  owner_id = auth.uid() and (farm_id is null or exists (select 1 from public.farms p where p.id = farm_id and p.owner_id = auth.uid())));

alter table public.animal_locations enable row level security;
create policy "animal_locations: read own" on public.animal_locations for select using (owner_id = auth.uid());
create policy "animal_locations: insert manual" on public.animal_locations for insert with check (
  owner_id = auth.uid() and source = 'manual' and device_id is null
  and exists (select 1 from public.livestock p where p.id = animal_id and p.owner_id = auth.uid()));
create policy "animal_locations: delete own" on public.animal_locations for delete using (owner_id = auth.uid());

-- ---------- Helpers ----------
-- Latest value per device + sensor (for live dashboards).
create view public.latest_sensor_values with (security_invoker = true) as
  select distinct on (r.device_id, r.sensor_type)
    r.device_id, r.sensor_type, r.value, r.source, r.quality, r.recorded_at, r.pond_id, r.farm_id, r.animal_id
  from public.sensor_readings r
  where r.device_id is not null
  order by r.device_id, r.sensor_type, r.recorded_at desc;

-- Chart data: min / avg / max per time bucket, so a 30-day chart is ~120 points instead of thousands.
create or replace function public.sensor_series(
  p_sensor_type text, p_from timestamptz, p_to timestamptz,
  p_device uuid default null, p_pond uuid default null, p_farm uuid default null, p_animal uuid default null,
  p_bucket interval default null
) returns table (bucket timestamptz, avg_value numeric, min_value numeric, max_value numeric, n int, sources text[])
language sql stable security invoker set search_path = public as $$
  with b as (select coalesce(p_bucket, greatest(interval '5 minutes', (p_to - p_from) / 120)) as w)
  select date_bin(b.w, r.recorded_at, p_from) as bucket,
         round(avg(r.value), 3), min(r.value), max(r.value), count(*)::int, array_agg(distinct r.source)
  from public.sensor_readings r, b
  where r.sensor_type = p_sensor_type and r.recorded_at >= p_from and r.recorded_at < p_to
    and (p_device is null or r.device_id = p_device)
    and (p_pond is null or r.pond_id = p_pond)
    and (p_farm is null or r.farm_id = p_farm)
    and (p_animal is null or r.animal_id = p_animal)
    and r.quality = 'ok'
  group by 1 order by 1;
$$;

-- Live updates for dashboards (Realtime respects the RLS above).
alter publication supabase_realtime add table public.sensor_readings, public.sensor_alerts, public.sensor_devices, public.device_channels, public.actuator_commands, public.animal_locations;
