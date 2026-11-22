-- Same fixture as tests/reports.test.ts ("aggregates only the last N days..."); today = 2026-11-22.
-- Run after stubs + migrations (+ rls_test.sql, which creates users A/B). Fails loudly on any mismatch.
\set A '''11111111-1111-1111-1111-111111111111'''
delete from farms; delete from ponds; delete from livestock;
insert into farms(owner_id, name, area_acres) values (:A,'f1',4.5),(:A,'f2',null),(:A,'f3',2.25);
insert into crops(owner_id, farm_id, name, status) select :A, id, 'c', s from (select id from farms where name='f1') f, unnest(array['growing','growing','harvested']) s;
insert into crop_records(owner_id, crop_id, activity, scheduled_for, completed_at)
  select :A, (select id from crops limit 1), 'other', d::date, c::timestamptz from (values
  ('2026-11-10','2026-11-10T03:00:00Z'),('2026-09-01','2026-09-01T03:00:00Z'),('2026-11-20',null),('2026-11-25',null)) v(d,c);
insert into crop_scans(owner_id, image_paths) values (:A, '{x}');
insert into disease_reports(owner_id, scan_id, severity) select :A, id, s from crop_scans, unnest(array['moderate','moderate',null]) s;
insert into ponds(owner_id, name, status) values (:A,'p1','active'),(:A,'p2','idle');
insert into water_quality_records(owner_id, pond_id, recorded_at, ph, dissolved_oxygen_mgl) select :A, id, t::timestamptz, 7.8, o from ponds, (values
  ('2026-11-01T05:00:00Z',6.0),('2026-11-21T05:00:00Z',2.5)) v(t,o) where name='p1';
insert into fish_records(owner_id, pond_id, record_type, recorded_on, quantity, unit) select :A, (select id from ponds where name='p1'), r, d::date, q, u from (values
  ('feeding','2026-11-21',25,'kg'),('feeding','2026-11-20',1000,'pcs'),('harvest','2026-10-01',900,'kg'),('mortality','2026-11-15',40,'pcs')) v(r,d,q,u);
insert into livestock(owner_id, species, status, tag_id) values (:A,'cow','sick','1'),(:A,'cow','healthy','2'),(:A,'goat','sold','3');
insert into vaccination_records(owner_id, animal_id, vaccine_name, status, given_on, due_on) select :A, (select id from livestock where tag_id='1'), 'v', s, g::date, d::date from (values
  ('completed','2026-11-05',null),('scheduled',null,'2026-11-01')) v(s,g,d);

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
do $$ declare r jsonb := public.report_summary(30); n int; begin
  assert r->'agriculture' = '{"farms":3,"acres":6.75,"cropsByStatus":{"growing":2,"harvested":1},"tasksDone":1,"tasksOverdue":1,"scans":3,"scansBySeverity":{"moderate":2}}'::jsonb, 'agriculture: ' || (r->'agriculture')::text;
  assert r->'aquaculture' = '{"ponds":2,"activePonds":1,"readings":2,"pondsByLevel":{"bad":1},"feedKg":25,"harvestKg":0,"mortality":40}'::jsonb, 'aquaculture: ' || (r->'aquaculture')::text;
  assert r->'livestock' = '{"animals":2,"bySpecies":{"cow":2},"sick":1,"vaccinesGiven":1,"vaccinesOverdue":1}'::jsonb, 'livestock: ' || (r->'livestock')::text;
  select count(*) into n from latest_water_readings; assert n = 1, 'latest per pond';
  assert (select dissolved_oxygen_mgl from latest_water_readings) = 2.5, 'latest is newest';
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ begin
  assert (public.report_summary(30)->'agriculture'->>'farms')::int = 0, 'B must not see A''s farms';
  assert (select count(*) from latest_water_readings) = 0, 'B must not see A''s readings';
end $$;
reset role;
select 'REPORT TESTS PASSED' as result;
