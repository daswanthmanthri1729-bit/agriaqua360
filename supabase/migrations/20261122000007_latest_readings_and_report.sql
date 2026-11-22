-- S7: let the database do the work the phone was doing.
-- Both run as the caller (security_invoker / SECURITY INVOKER), so RLS still limits them to the farmer's own rows.

-- Latest water reading per pond (Home + Aqua dashboards used to download up to 500 readings).
create view public.latest_water_readings with (security_invoker = true) as
  select distinct on (pond_id) * from public.water_quality_records order by pond_id, recorded_at desc;
grant select on public.latest_water_readings to authenticated;

-- Farming report totals in one call (was 9 tables x up to 2000 rows summed on the phone).
-- Mirrors src/features/reports/summary.ts (guide ranges from src/features/aquaculture/waterQuality.ts).
create or replace function public.report_summary(days int default 30) returns jsonb
language sql stable security invoker set search_path = public as $$
  with p as (select current_date as today, current_date - greatest(1, least(days, 366)) as since),
  wl as (
    select l.*,
      case
        when (l.ph is not null and (l.ph < 6.5 or l.ph > 9))
          or (l.dissolved_oxygen_mgl is not null and l.dissolved_oxygen_mgl < 3)
          or (l.temperature_c is not null and (l.temperature_c < 22 or l.temperature_c > 34))
          or (l.ammonia_mgl is not null and l.ammonia_mgl > 1)
          or (l.turbidity_cm is not null and (l.turbidity_cm < 20 or l.turbidity_cm > 60)) then 'bad'
        when (l.ph is not null and (l.ph < 7 or l.ph > 8.5))
          or (l.dissolved_oxygen_mgl is not null and l.dissolved_oxygen_mgl < 5)
          or (l.temperature_c is not null and (l.temperature_c < 26 or l.temperature_c > 32))
          or (l.ammonia_mgl is not null and l.ammonia_mgl > 0.5)
          or (l.turbidity_cm is not null and (l.turbidity_cm < 30 or l.turbidity_cm > 45)) then 'warn'
        when coalesce(l.ph, l.dissolved_oxygen_mgl, l.temperature_c, l.ammonia_mgl, l.turbidity_cm) is not null then 'ok'
      end as level
    from latest_water_readings l)
  select jsonb_build_object(
    'days', greatest(1, least(days, 366)),
    'agriculture', jsonb_build_object(
      'farms', (select count(*) from farms),
      'acres', (select coalesce(round(sum(area_acres)::numeric, 2), 0) from farms),
      'cropsByStatus', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from crops group by status) x), '{}'),
      'tasksDone', (select count(*) from crop_records, p where completed_at is not null and (completed_at at time zone 'Asia/Kolkata')::date between p.since and p.today),
      'tasksOverdue', (select count(*) from crop_records, p where completed_at is null and scheduled_for < p.today),
      'scans', (select count(*) from disease_reports),
      'scansBySeverity', coalesce((select jsonb_object_agg(severity, n) from (select severity, count(*) n from disease_reports where severity is not null group by severity) x), '{}')),
    'aquaculture', jsonb_build_object(
      'ponds', (select count(*) from ponds),
      'activePonds', (select count(*) from ponds where status = 'active'),
      'readings', (select count(*) from water_quality_records, p where (recorded_at at time zone 'Asia/Kolkata')::date between p.since and p.today),
      'pondsByLevel', coalesce((select jsonb_object_agg(level, n) from (select level, count(*) n from wl where level is not null group by level) x), '{}'),
      'feedKg', (select coalesce(sum(quantity), 0) from fish_records, p where record_type = 'feeding' and unit = 'kg' and recorded_on between p.since and p.today),
      'harvestKg', (select coalesce(sum(quantity), 0) from fish_records, p where record_type = 'harvest' and unit = 'kg' and recorded_on between p.since and p.today),
      'mortality', (select coalesce(sum(quantity), 0) from fish_records, p where record_type = 'mortality' and recorded_on between p.since and p.today)),
    'livestock', jsonb_build_object(
      'animals', (select count(*) from livestock where status not in ('sold', 'deceased')),
      'bySpecies', coalesce((select jsonb_object_agg(species, n) from (select species, count(*) n from livestock where status not in ('sold', 'deceased') group by species) x), '{}'),
      'sick', (select count(*) from livestock where status in ('sick', 'under_treatment')),
      'vaccinesGiven', (select count(*) from vaccination_records, p where status = 'completed' and given_on between p.since and p.today),
      'vaccinesOverdue', (select count(*) from vaccination_records, p where status = 'scheduled' and due_on < p.today))
  ) from p;
$$;
revoke all on function public.report_summary(int) from public, anon;
grant execute on function public.report_summary(int) to authenticated;
