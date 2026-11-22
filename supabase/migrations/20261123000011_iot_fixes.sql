-- Duplicate protection must be a plain unique index so ingest can use ON CONFLICT (device_id, sensor_type, recorded_at).
-- Manual readings have no device_id and NULLs never conflict, so nothing changes for them.
create unique index sensor_readings_dedupe2 on public.sensor_readings(device_id, sensor_type, recorded_at);
drop index public.sensor_readings_dedupe;
alter index public.sensor_readings_dedupe2 rename to sensor_readings_dedupe;
