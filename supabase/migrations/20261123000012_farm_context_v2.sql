-- AI assistant context v2: adds crop stage/harvest dates, live sensor values (with source), open alerts,
-- the latest soil test and recent milk records. Replaces the function body only; no data changes.
create or replace function public.farm_context() returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'location', (select jsonb_build_object('village', village, 'district', district, 'state', state, 'sectors', sectors, 'land_acres', land_acres)
                 from profiles where id = auth.uid()),
    'crops_growing', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'variety', variety, 'season', season, 'sowing_date', sowing_date,
                 'growth_stage', growth_stage, 'expected_harvest_date', expected_harvest_date))
                 from (select * from crops where status = 'growing' order by created_at desc limit 10) c), '[]'),
    'ponds', coalesce((select jsonb_agg(jsonb_build_object('name', p.name, 'species', p.species, 'stocking_date', p.stocking_date, 'status', p.status, 'latest_water',
                 (select jsonb_build_object('recorded_at', w.recorded_at, 'source', w.source, 'ph', w.ph, 'dissolved_oxygen_mgl', w.dissolved_oxygen_mgl, 'temperature_c', w.temperature_c,
                         'ammonia_mgl', w.ammonia_mgl, 'salinity_ppt', w.salinity_ppt, 'turbidity_ntu', w.turbidity_ntu, 'water_level_cm', w.water_level_cm)
                  from water_quality_records w where w.pond_id = p.id order by w.recorded_at desc limit 1)))
                 from (select * from ponds order by created_at desc limit 10) p), '[]'),
    'animals_by_species_status', coalesce((select jsonb_object_agg(k, n) from (select species || '_' || status as k, count(*) as n from livestock
                 where status not in ('sold', 'deceased') group by 1) a), '{}'),
    'upcoming_vaccinations', coalesce((select jsonb_agg(jsonb_build_object('vaccine_name', vaccine_name, 'due_on', due_on))
                 from (select * from vaccination_records where status = 'scheduled' order by due_on limit 5) v), '[]'),
    'sensors', coalesce((select jsonb_agg(jsonb_build_object('device', d.name, 'kind', d.kind, 'simulated', d.is_simulated, 'last_seen_at', d.last_seen_at,
                 'values', (select jsonb_object_agg(l.sensor_type, jsonb_build_object('value', l.value, 'at', l.recorded_at)) from latest_sensor_values l where l.device_id = d.id)))
                 from (select * from sensor_devices order by last_seen_at desc nulls last limit 8) d), '[]'),
    'open_alerts', coalesce((select jsonb_agg(jsonb_build_object('kind', kind, 'sensor_type', sensor_type, 'value', value, 'limit', limit_value, 'source', source, 'since', created_at))
                 from (select * from sensor_alerts where status = 'open' order by created_at desc limit 8) a), '[]'),
    'latest_soil_test', (select jsonb_build_object('tested_on', tested_on, 'source', source, 'ph', ph, 'ec_dsm', ec_dsm, 'organic_carbon_pct', organic_carbon_pct,
                 'n_kg_ha', nitrogen_kg_ha, 'p_kg_ha', phosphorus_kg_ha, 'k_kg_ha', potassium_kg_ha) from soil_tests order by tested_on desc limit 1),
    'milk_last_7_days_litres', (select sum(value) from animal_records where record_type = 'milk' and recorded_on >= current_date - 7)
  );
$$;
