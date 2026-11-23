import { cropTimeline, gdd, harvestWindows, seasonOf, soilAdvice, toQuintal, weatherRisks, yieldEstimate } from '@/features/intel/crop';

describe('crop intelligence', () => {
  it('builds a timeline from the sowing date', () => {
    const c = cropTimeline({ name: 'Paddy', sowing_date: '2026-08-01', expected_harvest_date: null }, '2026-10-01');
    expect(c).toMatchObject({ days: 61, total: 120, stage: 'flowering', harvest: '2026-11-29', daysLeft: 59 });
    expect(cropTimeline({ name: 'x', sowing_date: null, expected_harvest_date: null }, '2026-10-01')).toBeNull();
    expect(cropTimeline({ name: 'Maize', sowing_date: '2026-01-01', expected_harvest_date: '2026-04-11' }, '2026-06-01')?.stage).toBe('harvest');
  });
  it('sums growing degree days', () => {
    expect(gdd([{ temp_min: 20, temp_max: 30 }, { temp_min: 5, temp_max: 9 }, { temp_min: null, temp_max: 30 }])).toBe(15);
  });
  it('flags weather-driven risks', () => {
    const humid = Array.from({ length: 14 }, () => ({ temp: 26, humidity: 92, rain_mm: 0 }));
    const r = weatherRisks(humid);
    expect(r[0]).toMatchObject({ kind: 'fungal', level: 'high', hours: 14 });
    expect(weatherRisks(Array.from({ length: 10 }, () => ({ temp: 36, humidity: 30, rain_mm: 0 }))).find((x) => x.kind === 'sucking_pests')?.level).toBe('medium');
  });
  it('finds dry harvest days', () => {
    expect(harvestWindows([{ date: 'a', rain_mm: 0, pop: 10, wind_kmh: 10 }, { date: 'b', rain_mm: 8, pop: 80, wind_kmh: 10 }, { date: 'c', rain_mm: 1, pop: 50, wind_kmh: 10 }])).toEqual(['a']);
  });
  it('estimates yield from own history first, then typical averages', () => {
    expect(yieldEstimate('Paddy', 2, [{ qtlPerAcre: 25 }, { qtlPerAcre: 27 }])).toMatchObject({ basis: 'own', perAcre: 26, mid: 52, low: 41.6, high: 62.4 });
    expect(yieldEstimate('Paddy', 2, [])).toMatchObject({ basis: 'typical', mid: 44 });
    expect(yieldEstimate('Dragon fruit', 2, [])).toBeNull();
    expect([toQuintal(250, 'kg'), toQuintal(2, 't'), toQuintal(12, 'qtl'), toQuintal(5, 'L')]).toEqual([2.5, 20, 12, null]);
  });
  it('gives soil advice and seasons', () => {
    expect(soilAdvice({ ph: 5.6, organic_carbon_pct: 0.3, nitrogen_kg_ha: 200, phosphorus_kg_ha: 30, potassium_kg_ha: 300, ec_dsm: 0.4, zinc_ppm: 0.4 }))
      .toEqual(['soilAi.adv.lime', 'soilAi.adv.organic', 'soilAi.adv.nLow', 'soilAi.adv.zinc']);
    expect(soilAdvice({ ph: 7, organic_carbon_pct: 0.6, nitrogen_kg_ha: 300, phosphorus_kg_ha: 15, potassium_kg_ha: 150, ec_dsm: 0.5, zinc_ppm: 1 })).toEqual(['soilAi.adv.balanced']);
    expect([seasonOf(7), seasonOf(12), seasonOf(4)]).toEqual(['kharif', 'rabi', 'zaid']);
  });
});
