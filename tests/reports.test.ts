import { summarise } from '@/features/reports/summary';

const T = '2026-11-22';
const empty = { farms: [], crops: [], records: [], scans: [], ponds: [], readings: [], fish: [], animals: [], vaccinations: [] };

it('empty farm gives zeros, not errors', () => {
  const r = summarise(empty, T);
  expect(r.agriculture).toMatchObject({ farms: 0, acres: 0, tasksDone: 0, tasksOverdue: 0, scans: 0 });
  expect(r.aquaculture.feedKg).toBe(0);
  expect(r.livestock.animals).toBe(0);
});

it('aggregates only the last N days and the latest reading per pond', () => {
  const r = summarise({
    ...empty,
    farms: [{ area_acres: 4.5 }, { area_acres: null }, { area_acres: 2.25 }],
    crops: [{ status: 'growing' }, { status: 'growing' }, { status: 'harvested' }],
    records: [
      { scheduled_for: '2026-11-10', completed_at: '2026-11-10T03:00:00Z' },
      { scheduled_for: '2026-09-01', completed_at: '2026-09-01T03:00:00Z' }, // outside 30 days
      { scheduled_for: '2026-11-20', completed_at: null }, // overdue
      { scheduled_for: '2026-11-25', completed_at: null }, // future
    ],
    scans: [{ severity: 'moderate' }, { severity: 'moderate' }, { severity: null }],
    ponds: [{ id: 'p1', status: 'active' }, { id: 'p2', status: 'idle' }],
    readings: [
      { pond_id: 'p1', recorded_at: '2026-11-01T05:00:00Z', ph: 7.8, dissolved_oxygen_mgl: 6, temperature_c: null, ammonia_mgl: null, turbidity_cm: null },
      { pond_id: 'p1', recorded_at: '2026-11-21T05:00:00Z', ph: 7.8, dissolved_oxygen_mgl: 2.5, temperature_c: null, ammonia_mgl: null, turbidity_cm: null },
    ],
    fish: [
      { record_type: 'feeding', recorded_on: '2026-11-21', quantity: 25, unit: 'kg' },
      { record_type: 'feeding', recorded_on: '2026-11-20', quantity: 1000, unit: 'pcs' }, // not kg
      { record_type: 'harvest', recorded_on: '2026-10-01', quantity: 900, unit: 'kg' }, // outside window
      { record_type: 'mortality', recorded_on: '2026-11-15', quantity: 40, unit: 'pcs' },
    ],
    animals: [{ species: 'cow', status: 'sick' }, { species: 'cow', status: 'healthy' }, { species: 'goat', status: 'sold' }],
    vaccinations: [{ status: 'completed', due_on: null, given_on: '2026-11-05' }, { status: 'scheduled', due_on: '2026-11-01', given_on: null }],
  }, T);
  expect(r.agriculture).toMatchObject({ farms: 3, acres: 6.75, cropsByStatus: { growing: 2, harvested: 1 }, tasksDone: 1, tasksOverdue: 1, scans: 3, scansBySeverity: { moderate: 2 } });
  expect(r.aquaculture).toMatchObject({ ponds: 2, activePonds: 1, readings: 2, pondsByLevel: { bad: 1 }, feedKg: 25, harvestKg: 0, mortality: 40 });
  expect(r.livestock).toMatchObject({ animals: 2, bySpecies: { cow: 2 }, sick: 1, vaccinesGiven: 1, vaccinesOverdue: 1 });
});
