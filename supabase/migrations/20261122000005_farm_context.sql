-- One round trip for the AI assistant's farm context (was 6 queries). SECURITY INVOKER: the caller's RLS
-- still applies, so it only ever returns the calling farmer's own rows.
create or replace function public.farm_context() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'location', (select jsonb_build_object('village', village, 'district', district, 'state', state, 'sectors', sectors, 'land_acres', land_acres)
                 from profiles where id = auth.uid()),
    'crops_growing', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'variety', variety, 'season', season, 'sowing_date', sowing_date))
                 from (select * from crops where status = 'growing' order by created_at desc limit 10) c), '[]'),
    'ponds', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'species', p.species, 'stocking_date', p.stocking_date, 'status', p.status, 'latest_water',
                 (select jsonb_build_object('recorded_at', w.recorded_at, 'ph', w.ph, 'dissolved_oxygen_mgl', w.dissolved_oxygen_mgl, 'temperature_c', w.temperature_c,
                         'ammonia_mgl', w.ammonia_mgl, 'salinity_ppt', w.salinity_ppt)
                  from water_quality_records w where w.pond_id = p.id order by w.recorded_at desc limit 1)))
                 from (select * from ponds order by created_at desc limit 10) p), '[]'),
    'animals_by_species_status', coalesce((select jsonb_object_agg(k, n) from (select species || '_' || status as k, count(*) as n from livestock
                 where status not in ('sold', 'deceased') group by 1) a), '{}'),
    'upcoming_vaccinations', coalesce((select jsonb_agg(jsonb_build_object('vaccine_name', vaccine_name, 'due_on', due_on))
                 from (select * from vaccination_records where status = 'scheduled' order by due_on limit 5) v), '[]')
  );
$$;
revoke all on function public.farm_context() from public, anon;
grant execute on function public.farm_context() to authenticated;
