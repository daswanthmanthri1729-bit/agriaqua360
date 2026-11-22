-- Lets the app cancel a task's phone reminder when it is done or its crop is deleted.
alter table public.crop_records add column notification_id text;

-- Prevention steps from AI treatment plans get their own type instead of being filed as 'cultural'.
alter table public.treatment_records drop constraint treatment_records_treatment_type_check;
alter table public.treatment_records add constraint treatment_records_treatment_type_check
  check (treatment_type in ('organic','chemical','cultural','biological','prevention'));
