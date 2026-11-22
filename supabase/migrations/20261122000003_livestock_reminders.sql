-- Phone reminder ids so vaccination / health follow-up reminders can be cancelled when done or deleted.
alter table public.vaccination_records add column notification_id text;
alter table public.animal_health_records add column notification_id text;
