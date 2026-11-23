import { useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invoke, must, queryClient } from '@/lib/query';
import type { ActuatorCommand, AutomationRule, DeviceChannel, DeviceKind, LatestValue, SensorAlert, SensorDevice, SeriesPoint, Threshold } from '@/types/database';

const invalidate = (...keys: string[]) => Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));

// Units and physical ranges mirror public.sensor_types (migration 0008).
export const SENSOR_UNITS: Record<string, string> = {
  soil_moisture: '%', soil_temp: '°C', soil_ph: 'pH', soil_n: 'mg/kg', soil_p: 'mg/kg', soil_k: 'mg/kg', air_temp: '°C', air_humidity: '%',
  light: 'lux', rainfall: 'mm', water_flow: 'L', water_do: 'mg/L', water_temp: '°C', water_ph: 'pH', turbidity: 'NTU', ammonia: 'mg/L',
  water_level: 'cm', salinity: 'ppt', body_temp: '°C', activity: 'steps/h', rumination: 'min/h', battery: '%',
};
export const KIND_SENSORS: Record<DeviceKind, string[]> = {
  pond_node: ['water_do', 'water_temp', 'water_ph', 'turbidity', 'ammonia', 'water_level', 'salinity', 'battery'],
  field_node: ['soil_moisture', 'soil_temp', 'air_temp', 'air_humidity', 'soil_ph', 'light', 'rainfall', 'battery'],
  collar: ['body_temp', 'activity', 'rumination', 'battery'],
  controller: ['water_flow'],
  gateway: [],
};
export const ALL_SENSORS = Object.keys(SENSOR_UNITS);
export const KIND_ICON: Record<DeviceKind, 'grass' | 'water' | 'router' | 'settings-remote' | 'pets'> = {
  field_node: 'grass', pond_node: 'water', gateway: 'router', controller: 'settings-remote', collar: 'pets',
};

/** online = reported within 3 intervals (min 15 min); simulated devices only report when the simulator runs. */
export function deviceStatus(d: Pick<SensorDevice, 'last_seen_at' | 'reporting_interval_s' | 'is_simulated'>, now = Date.now()): 'online' | 'offline' | 'never' {
  if (!d.last_seen_at) return 'never';
  return now - Date.parse(d.last_seen_at) <= Math.max(900, d.reporting_interval_s * 3) * 1000 ? 'online' : 'offline';
}

/** Re-fetch the given queries when rows change in a table (Supabase Realtime, RLS-filtered). Debounced. */
export function useRealtime(table: string, filter: string | null, keys: unknown[][], enabled = true) {
  const keysRef = useRef(keys);
  useEffect(() => { keysRef.current = keys; });
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase.channel(`rt:${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => keysRef.current.forEach((k) => queryClient.invalidateQueries({ queryKey: k })), 800);
      })
      .subscribe();
    return () => { if (timer) clearTimeout(timer); supabase.removeChannel(ch); };
  }, [table, filter, enabled]);
}

// ---------- devices ----------
export const useDevices = () =>
  useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const [devices, latest, alerts] = await Promise.all([
        must<SensorDevice[]>(supabase.from('sensor_devices').select('*').order('created_at', { ascending: false })),
        must<LatestValue[]>(supabase.from('latest_sensor_values').select('*')),
        must<SensorAlert[]>(supabase.from('sensor_alerts').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(50)),
      ]);
      return { devices, latest, alerts };
    },
  });

export const useDevice = (id: string) =>
  useQuery({
    queryKey: ['device', id],
    queryFn: async () => {
      const [device, channels, thresholds, latest] = await Promise.all([
        must<SensorDevice>(supabase.from('sensor_devices').select('*').eq('id', id).single()),
        must<DeviceChannel[]>(supabase.from('device_channels').select('*').eq('device_id', id).order('kind').order('channel')),
        must<Threshold[]>(supabase.from('sensor_thresholds').select('*').eq('device_id', id)),
        must<LatestValue[]>(supabase.from('latest_sensor_values').select('*').eq('device_id', id)),
      ]);
      return { device, channels, thresholds, latest };
    },
  });

/** Latest values for a pond / farm / animal (all its devices). */
export const useLatestFor = (scope: { pondId?: string; farmId?: string; animalId?: string }) =>
  useQuery({
    queryKey: ['latest', scope],
    enabled: !!(scope.pondId || scope.farmId || scope.animalId),
    queryFn: () => {
      let q = supabase.from('latest_sensor_values').select('*');
      if (scope.pondId) q = q.eq('pond_id', scope.pondId);
      if (scope.farmId) q = q.eq('farm_id', scope.farmId);
      if (scope.animalId) q = q.eq('animal_id', scope.animalId);
      return must<LatestValue[]>(q);
    },
  });

export type RegisterInput = {
  name: string; kind: DeviceKind; simulated: boolean; farm_id?: string | null; pond_id?: string | null; animal_id?: string | null;
  sensors: string[]; actuators: { channel: string; type: string; label: string; max_run_s: number }[]; transport: 'https' | 'mqtt';
};
export const useRegisterDevice = () =>
  useMutation({
    mutationFn: (input: RegisterInput) => invoke<{ device: SensorDevice; secret: string | null; ingest_url: string; mqtt_topic: string }>('devices', { action: 'register', ...input }),
    onSuccess: () => invalidate('devices'),
  });
export const useRotateKey = () => useMutation({ mutationFn: (id: string) => invoke<{ secret: string; ingest_url: string }>('devices', { action: 'rotate_key', device_id: id }) });
export const useSimulate = () =>
  useMutation({
    mutationFn: (p: { id: string; scenario: string; backfill_hours?: number }) => invoke<{ accepted: number; rejected: unknown[] }>('devices', { action: 'simulate', device_id: p.id, scenario: p.scenario, backfill_hours: p.backfill_hours ?? 0 }),
    onSuccess: () => invalidate('devices', 'device', 'latest', 'series', 'alerts', 'notifications', 'readings'),
  });
export const useUpdateDevice = () =>
  useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<SensorDevice> }) => must(supabase.from('sensor_devices').update(patch).eq('id', id)), onSuccess: () => invalidate('devices', 'device') });
export const useDeleteDevice = () =>
  useMutation({ mutationFn: (id: string) => must(supabase.from('sensor_devices').delete().eq('id', id)), onSuccess: () => invalidate('devices', 'alerts', 'latest') });
export const useUpdateChannel = () =>
  useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<DeviceChannel> }) => must(supabase.from('device_channels').update(patch).eq('id', id)), onSuccess: () => invalidate('device') });

/** Create or update the device's threshold for one parameter (null limits remove it). */
export const useSetThreshold = () =>
  useMutation({
    mutationFn: async ({ deviceId, sensorType, min, max, existing }: { deviceId: string; sensorType: string; min: number | null; max: number | null; existing?: Threshold }) => {
      if (min == null && max == null) return existing ? must(supabase.from('sensor_thresholds').delete().eq('id', existing.id)) : null;
      if (existing) return must(supabase.from('sensor_thresholds').update({ min_value: min, max_value: max, enabled: true }).eq('id', existing.id));
      return must(supabase.from('sensor_thresholds').insert({ device_id: deviceId, sensor_type: sensorType, min_value: min, max_value: max }));
    },
    onSuccess: () => invalidate('device'),
  });

// ---------- history ----------
export type SeriesQuery = { sensorType: string; hours: number; deviceId?: string; pondId?: string; farmId?: string; animalId?: string };
export const useSeries = (q: SeriesQuery | null) =>
  useQuery({
    queryKey: ['series', q],
    enabled: !!q,
    staleTime: 60_000,
    queryFn: () => {
      const to = new Date(), from = new Date(to.getTime() - q!.hours * 3600_000);
      return must<SeriesPoint[]>(supabase.rpc('sensor_series', {
        p_sensor_type: q!.sensorType, p_from: from.toISOString(), p_to: to.toISOString(),
        p_device: q!.deviceId ?? null, p_pond: q!.pondId ?? null, p_farm: q!.farmId ?? null, p_animal: q!.animalId ?? null,
      }));
    },
  });

// ---------- alerts ----------
export const useAlerts = (status: 'open' | 'all') =>
  useQuery({
    queryKey: ['alerts', status],
    queryFn: () => {
      let q = supabase.from('sensor_alerts').select('*').order('created_at', { ascending: false }).limit(100);
      if (status === 'open') q = q.neq('status', 'resolved');
      return must<SensorAlert[]>(q);
    },
  });
export const useUpdateAlert = () =>
  useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'acknowledged' | 'resolved' }) =>
      must(supabase.from('sensor_alerts').update({ status, [status === 'acknowledged' ? 'acknowledged_at' : 'resolved_at']: new Date().toISOString() }).eq('id', id)),
    onSuccess: () => invalidate('alerts', 'devices'),
  });

// ---------- equipment ----------
export const useCommands = (deviceId?: string) =>
  useQuery({
    queryKey: ['commands', deviceId ?? 'all'],
    queryFn: () => {
      let q = supabase.from('actuator_commands').select('*').order('created_at', { ascending: false }).limit(30);
      if (deviceId) q = q.eq('device_id', deviceId);
      return must<ActuatorCommand[]>(q);
    },
  });
export const useSendCommand = () =>
  useMutation({
    mutationFn: (c: { device_id: string; channel: string; action: 'on' | 'off'; duration_s: number | null }) => must(supabase.from('actuator_commands').insert(c)),
    onSuccess: () => invalidate('commands'),
  });
export const useCancelCommand = () =>
  useMutation({ mutationFn: (id: string) => must(supabase.from('actuator_commands').update({ status: 'cancelled' }).eq('id', id)), onSuccess: () => invalidate('commands') });

/** All actuator channels across the farmer's controllers (equipment overview). */
export const useEquipment = () =>
  useQuery({
    queryKey: ['equipment'],
    queryFn: async () => {
      const [channels, devices] = await Promise.all([
        must<DeviceChannel[]>(supabase.from('device_channels').select('*').eq('kind', 'actuator')),
        must<SensorDevice[]>(supabase.from('sensor_devices').select('*').eq('kind', 'controller')),
      ]);
      return channels.map((c) => ({ ...c, device: devices.find((d) => d.id === c.device_id) })).filter((c) => c.device);
    },
  });

// ---------- automation ----------
export const useRules = () => useQuery({ queryKey: ['rules'], queryFn: () => must<AutomationRule[]>(supabase.from('automation_rules').select('*').order('created_at', { ascending: false })) });
export const useSaveRule = () =>
  useMutation({
    mutationFn: ({ id, ...r }: Partial<AutomationRule> & { id?: string }) => (id ? must(supabase.from('automation_rules').update(r).eq('id', id)) : must(supabase.from('automation_rules').insert(r))),
    onSuccess: () => invalidate('rules'),
  });
export const useDeleteRule = () => useMutation({ mutationFn: (id: string) => must(supabase.from('automation_rules').delete().eq('id', id)), onSuccess: () => invalidate('rules') });
