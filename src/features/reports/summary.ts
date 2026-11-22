// Pure report aggregation over the farmer's own rows (fetched in api.ts). Kept pure so it is unit-tested.
import { overall, Level } from '@/features/aquaculture/waterQuality';
import { vaccState } from '@/features/livestock/vaccination';
import { addDays } from '@/lib/dates';
import type { Animal, Crop, CropRecord, Farm, FishRecord, Pond, Vaccination, WaterReading } from '@/types/database';

export type ReportInput = {
  farms: Pick<Farm, 'area_acres'>[];
  crops: Pick<Crop, 'status'>[];
  records: Pick<CropRecord, 'scheduled_for' | 'completed_at'>[];
  scans: { severity: string | null }[];
  ponds: Pick<Pond, 'id' | 'status'>[];
  readings: Pick<WaterReading, 'pond_id' | 'recorded_at' | 'ph' | 'dissolved_oxygen_mgl' | 'temperature_c' | 'ammonia_mgl' | 'turbidity_cm'>[];
  fish: Pick<FishRecord, 'record_type' | 'recorded_on' | 'quantity' | 'unit'>[];
  animals: Pick<Animal, 'species' | 'status'>[];
  vaccinations: Pick<Vaccination, 'status' | 'due_on' | 'given_on'>[];
};

const count = <T extends string>(xs: (T | null)[]) => xs.reduce<Record<string, number>>((m, x) => (x ? { ...m, [x]: (m[x] ?? 0) + 1 } : m), {});

export function summarise(d: ReportInput, today: string, days = 30) {
  const from = addDays(today, -days);
  const inWindow = (s: string | null) => !!s && s >= from && s <= today;
  const sumKg = (type: string) => d.fish.filter((f) => f.record_type === type && f.unit === 'kg' && inWindow(f.recorded_on)).reduce((s, f) => s + (Number(f.quantity) || 0), 0);
  const latest = new Map<string, ReportInput['readings'][number]>();
  [...d.readings].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at)).forEach((r) => !latest.has(r.pond_id) && latest.set(r.pond_id, r));
  const pondLevels = [...latest.values()].map((r) => overall(r)).filter(Boolean) as Level[];
  const herd = d.animals.filter((a) => a.status !== 'sold' && a.status !== 'deceased');

  return {
    days,
    agriculture: {
      farms: d.farms.length,
      acres: Math.round(d.farms.reduce((s, f) => s + (Number(f.area_acres) || 0), 0) * 100) / 100,
      cropsByStatus: count(d.crops.map((c) => c.status)),
      tasksDone: d.records.filter((r) => r.completed_at && inWindow(r.completed_at.slice(0, 10))).length,
      tasksOverdue: d.records.filter((r) => !r.completed_at && !!r.scheduled_for && r.scheduled_for < today).length,
      scans: d.scans.length,
      scansBySeverity: count(d.scans.map((s) => s.severity)),
    },
    aquaculture: {
      ponds: d.ponds.length,
      activePonds: d.ponds.filter((p) => p.status === 'active').length,
      readings: d.readings.filter((r) => inWindow(r.recorded_at.slice(0, 10))).length,
      pondsByLevel: count(pondLevels),
      feedKg: sumKg('feeding'),
      harvestKg: sumKg('harvest'),
      mortality: d.fish.filter((f) => f.record_type === 'mortality' && inWindow(f.recorded_on)).reduce((s, f) => s + (Number(f.quantity) || 0), 0),
    },
    livestock: {
      animals: herd.length,
      bySpecies: count(herd.map((a) => a.species)),
      sick: herd.filter((a) => a.status === 'sick' || a.status === 'under_treatment').length,
      vaccinesGiven: d.vaccinations.filter((v) => v.status === 'completed' && inWindow(v.given_on)).length,
      vaccinesOverdue: d.vaccinations.filter((v) => vaccState(v, today) === 'overdue').length,
    },
  };
}
export type Report = ReturnType<typeof summarise>;
