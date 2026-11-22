-- INSERT ... RETURNING (supabase-js .insert().select()) checks the SELECT policy against the new row.
-- can_access_farm() runs its own query and cannot see a row created by the same statement, so owners
-- were refused their own new farm. A direct owner check passes; members still go through the helper.
drop policy "farms: members read" on public.farms;
create policy "farms: members read" on public.farms for select using (owner_id = auth.uid() or public.can_access_farm(id));
