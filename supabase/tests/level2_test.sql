-- Level 2 RLS + helper tests. Run after stubs.sql, all migrations and rls_test.sql (users A=1111…, B=2222… exist).
-- "Server" steps run as the superuser, standing in for Edge Functions using the service role.
reset role;
insert into sensor_devices(id, owner_id, farm_id, pond_id, name, kind) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   (select id from farms limit 1), (select id from ponds limit 1), 'Pond node', 'pond_node'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', null, null, 'Pump box', 'controller');
insert into sensor_devices(id, owner_id, name, kind, is_simulated) values
  ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Sim node', 'field_node', true);
insert into device_keys(device_id, key_hash, key_prefix) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x', 'ak_1');
insert into device_channels(owner_id, device_id, channel, kind, sensor_type) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','do','sensor','water_do');
insert into device_channels(owner_id, device_id, channel, kind, actuator_type, max_run_s) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002','pump1','actuator','pump', 1800);
insert into sensor_readings(owner_id, device_id, pond_id, sensor_type, value, source, recorded_at)
  select '11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',(select id from ponds limit 1),'water_do', 4 + g * 0.01, 'sensor', now() - (g || ' minutes')::interval
  from generate_series(1, 600) g;
insert into sensor_alerts(owner_id, device_id, sensor_type, kind, value, limit_value) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001','water_do','low',3.1,4);
insert into market_prices(state, district, market, commodity, arrival_date, min_price, max_price, modal_price) values
  ('Andhra Pradesh','Guntur','Tenali','Maize','2025-11-10',2000,2300,2180),
  ('Andhra Pradesh','Guntur','Tenali','Maize','2024-11-12',1900,2100,2000);

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ declare n int; begin
  -- owner sees own devices/readings, never key hashes
  select count(*) into n from sensor_devices; assert n = 3, 'A should see 3 devices';
  begin perform * from device_keys; assert false, 'device_keys readable'; exception when insufficient_privilege then null; end;
  -- cannot register devices directly or flip the simulated flag
  begin insert into sensor_devices(name, kind) values ('x','field_node'); assert false, 'direct device insert allowed'; exception when insufficient_privilege then null; end;
  begin update sensor_devices set is_simulated = false; assert false, 'is_simulated editable'; exception when insufficient_privilege then null; end;
  update sensor_devices set name = 'Pond 1 node' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  -- readings: only manual inserts, no edits
  begin insert into sensor_readings(sensor_type, value, source, recorded_at) values ('soil_moisture', 30, 'sensor', now()); assert false, 'fake sensor reading allowed'; exception when others then null; end;
  insert into sensor_readings(farm_id, sensor_type, value, source, recorded_at) values ((select id from farms limit 1), 'soil_moisture', 31, 'manual', now());
  begin update sensor_readings set value = 0; assert false, 'reading update allowed'; exception when insufficient_privilege then null; end;
  begin insert into water_quality_records(pond_id, ph, source) values ((select id from ponds limit 1), 7, 'sensor'); assert false, 'fake sensor WQ allowed'; exception when others then null; end;
  insert into water_quality_records(pond_id, ph, water_level_cm) values ((select id from ponds limit 1), 7.4, 120);
  -- alerts: acknowledge only
  update sensor_alerts set status = 'acknowledged', acknowledged_at = now();
  begin update sensor_alerts set value = 0; assert false, 'alert value editable'; exception when insufficient_privilege then null; end;
  -- equipment: within max run time only; cancel only
  insert into actuator_commands(device_id, channel, action, duration_s) values ('aaaaaaaa-0000-0000-0000-000000000002','pump1','on',600);
  begin insert into actuator_commands(device_id, channel, action, duration_s) values ('aaaaaaaa-0000-0000-0000-000000000002','pump1','on',7200); assert false, 'over max run allowed'; exception when others then null; end;
  begin insert into actuator_commands(device_id, channel, action, duration_s) values ('aaaaaaaa-0000-0000-0000-000000000001','do','on',60); assert false, 'command to a sensor channel allowed'; exception when others then null; end;
  begin update actuator_commands set status = 'done'; assert false, 'command forged as done'; exception when others then null; end;
  update actuator_commands set status = 'cancelled';
  select count(*) into n from actuator_commands where status = 'cancelled'; assert n = 1, 'cancel failed';
  -- rules start disabled
  insert into automation_rules(name, sensor_device_id, sensor_type, operator, threshold, target_device_id, target_channel, action, duration_s)
    values ('Aerate when DO low','aaaaaaaa-0000-0000-0000-000000000001','water_do','<',4,'aaaaaaaa-0000-0000-0000-000000000002','pump1','on',900);
  select count(*) into n from automation_rules where not enabled; assert n = 1, 'rule should start disabled';
  -- chart helper buckets
  select count(*) into n from sensor_series('water_do', now() - interval '10 hours', now(), p_device => 'aaaaaaaa-0000-0000-0000-000000000001');
  assert n between 100 and 125, 'expected ~120 buckets, got ' || n;
  select count(*) into n from latest_sensor_values; assert n = 1, 'latest values';
  -- finance + soil + animals + schemes
  insert into farm_transactions(kind, category, amount, farm_id) values ('expense','seed',1200,(select id from farms limit 1)), ('income','crop_sale',5000,(select id from farms limit 1));
  begin insert into farm_transactions(kind, category, amount) values ('income','seed',10); assert false, 'income with expense category'; exception when others then null; end;
  assert (select profit from finance_summary(current_date - 1, current_date + 1) where scope = 'total') = 3800, 'profit';
  insert into soil_tests(farm_id, tested_on, ph, nitrogen_kg_ha) values ((select id from farms limit 1), current_date, 6.8, 240);
  insert into animal_records(animal_id, record_type, value, session) values ((select id from livestock limit 1), 'milk', 8.5, 'morning');
  begin insert into animal_records(animal_id, record_type) values ((select id from livestock limit 1), 'milk'); assert false, 'milk without litres'; exception when others then null; end;
  select count(*) into n from schemes; assert n >= 10, 'schemes visible';
  insert into scheme_tracking(scheme_code) values ('pm_kisan');
  begin insert into market_prices(state,district,market,commodity,arrival_date) values ('x','x','x','x',current_date); assert false, 'market write allowed'; exception when insufficient_privilege then null; end;
  select count(*) into n from seasonal_prices('Maize', null, array[11]); assert n = 2, 'seasonal prices';
  insert into user_preferences(notify) values ('{"market": false}');
  insert into geofences(name, polygon) values ('Paddock', '[[80.1,16.2],[80.2,16.2],[80.2,16.3]]');
  insert into notifications(category, title) values ('sensor', 'DO low');
end $$;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ declare n int; begin
  select count(*) into n from sensor_devices; assert n = 0, 'B sees A devices';
  select count(*) into n from sensor_readings; assert n = 0, 'B sees A readings';
  select count(*) into n from sensor_alerts; assert n = 0, 'B sees A alerts';
  select count(*) into n from actuator_commands; assert n = 0, 'B sees A commands';
  select count(*) into n from farm_transactions; assert n = 0, 'B sees A money';
  select count(*) into n from soil_tests; assert n = 0, 'B sees A soil';
  select count(*) into n from animal_records; assert n = 0, 'B sees A animals';
  select count(*) into n from geofences; assert n = 0, 'B sees A geofences';
  select count(*) into n from market_prices; assert n = 2, 'market prices are shared';
  begin insert into actuator_commands(device_id, channel, action, duration_s) values ('aaaaaaaa-0000-0000-0000-000000000002','pump1','on',60); assert false, 'B controls A pump'; exception when others then null; end;
  begin insert into sensor_thresholds(device_id, sensor_type, min_value) values ('aaaaaaaa-0000-0000-0000-000000000001','water_do',4); assert false, 'B sets A threshold'; exception when others then null; end;
  begin insert into automation_rules(name, sensor_device_id, sensor_type, operator, threshold, target_device_id, target_channel, action, duration_s)
    values ('x','aaaaaaaa-0000-0000-0000-000000000001','water_do','<',4,'aaaaaaaa-0000-0000-0000-000000000002','pump1','on',60); assert false, 'B rule on A pump'; exception when others then null; end;
  update sensor_alerts set status = 'resolved';
  delete from sensor_devices;
  assert (select count(*) from farm_transactions) = 0;
  assert (select count(*) from finance_summary(current_date - 1, current_date + 1) where scope <> 'total') = 0, 'B finance leak';
end $$;
reset role;
do $$ begin
  assert (select count(*) from sensor_devices) = 3, 'B deleted A devices';
  assert (select status from sensor_alerts limit 1) = 'acknowledged', 'B changed A alert';
end $$;
select 'LEVEL 2 TESTS PASSED' as result;
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ declare c jsonb; begin
  c := farm_context();
  assert jsonb_array_length(c->'sensors') = 3, 'context sensors';
  assert jsonb_array_length(c->'open_alerts') = 0, 'acknowledged alert is not open';
  assert (c->'latest_soil_test'->>'ph')::numeric = 6.8, 'context soil test';
  assert (c->>'milk_last_7_days_litres')::numeric = 8.5, 'context milk';
end $$;
reset role;
select 'FARM CONTEXT V2 PASSED' as result;
