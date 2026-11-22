-- Run against a scratch DB after supabase/tests/stubs.sql + migrations. Fails loudly on any RLS leak.
insert into auth.users(id, email, raw_user_meta_data) values
 ('11111111-1111-1111-1111-111111111111','a@x.in','{"full_name":"Ramesh","phone":"+919876543210","sectors":["aquaculture","bogus"],"preferred_language":"te"}'),
 ('22222222-2222-2222-2222-222222222222','b@x.in','{"preferred_language":"xx","phone":"not-a-phone"}');

do $$ begin
  assert (select preferred_language from profiles where id='11111111-1111-1111-1111-111111111111') = 'te';
  assert (select sectors from profiles where id='11111111-1111-1111-1111-111111111111') = '{aquaculture}';
  assert (select preferred_language from profiles where id='22222222-2222-2222-2222-222222222222') = 'en';
  assert (select phone from profiles where id='22222222-2222-2222-2222-222222222222') is null;
end $$;

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
insert into farms(name) values ('A farm');
insert into crops(farm_id, name) select id, 'Paddy' from farms;
insert into ponds(name) values ('Pond 1');
insert into livestock(species, tag_id) values ('cow','C-1');
update profiles set village='Kovur', onboarding_completed=true where id = auth.uid();

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false);
do $$ declare n int; begin
  select count(*) into n from farms; assert n = 0, 'B sees A farms';
  select count(*) into n from crops; assert n = 0, 'B sees A crops';
  select count(*) into n from ponds; assert n = 0, 'B sees A ponds';
  select count(*) into n from profiles; assert n = 1, 'B sees other profiles';
  update profiles set full_name='hacked' where id='11111111-1111-1111-1111-111111111111';
  -- B cannot attach a crop to A's farm
  begin
    insert into crops(farm_id, name) select '00000000-0000-0000-0000-000000000000'::uuid, 'x';
    assert false, 'crop insert into foreign farm allowed';
  exception when others then null; end;
  begin
    insert into water_quality_records(pond_id, ph) values ((select id from ponds limit 1), 7);
  exception when others then null; end;
  -- storage: B cannot write into A's folder
  begin
    insert into storage.objects(bucket_id, name) values ('media','11111111-1111-1111-1111-111111111111/crops/x.jpg');
    assert false, 'storage cross-user write allowed';
  exception when insufficient_privilege then null; end;
  insert into storage.objects(bucket_id, name) values ('media','22222222-2222-2222-2222-222222222222/crops/x.jpg');
end $$;

reset role;
do $$ begin
  assert (select full_name from profiles where id='11111111-1111-1111-1111-111111111111') = 'Ramesh', 'cross-user profile update';
  assert (select count(*) from water_quality_records) = 0;
end $$;
select 'RLS TESTS PASSED' as result;
