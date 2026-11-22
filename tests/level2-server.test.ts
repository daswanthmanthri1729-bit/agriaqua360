import { shapeOpenMeteo, wmo } from '../supabase/functions/_shared/openmeteo';
import { climateSummary, powerHourlyToDaily, shapeSoilGrids, textureClass } from '../supabase/functions/_shared/environment';
import { dailySeries, harvestOutlook, isoDate, marketSummary, parseRecord } from '../supabase/functions/_shared/market';
import { alertText, breach, insidePolygon, ruleFires, simulateValue, validateReadings, wqSnapshot, latestByType } from '../supabase/functions/_shared/iot';

describe('open-meteo', () => {
  it('maps WMO codes to the conditions the app renders', () => {
    expect(wmo(0)).toEqual({ condition: 'Clear', icon: '01d' });
    expect(wmo(63, false)).toEqual({ condition: 'Rain', icon: '10n' });
    expect(wmo(95).condition).toBe('Thunderstorm');
    expect(wmo(45).condition).toBe('Mist');
  });
  it('shapes current, 48 h hourly and daily with ET0', () => {
    const hours = Array.from({ length: 72 }, (_, i) => `2026-11-22T${String(i % 24).padStart(2, '0')}:00`);
    const h = (v: number) => hours.map(() => v);
    const m = {
      latitude: 16.5, longitude: 80.2, utc_offset_seconds: 19800,
      current: { time: '2026-11-22T10:15', temperature_2m: 29.4, relative_humidity_2m: 66, apparent_temperature: 32, precipitation: 0, weather_code: 2, wind_speed_10m: 11, is_day: 1 },
      hourly: { time: hours, temperature_2m: h(28), relative_humidity_2m: h(70), precipitation_probability: h(10), precipitation: h(0), weather_code: h(1), wind_speed_10m: h(9), is_day: h(1), soil_moisture_0_to_1cm: h(0.214), soil_moisture_3_to_9cm: h(0.25) },
      daily: { time: ['2026-11-22', '2026-11-23'], weather_code: [61, 0], temperature_2m_max: [31.6, 30], temperature_2m_min: [21.2, 20], precipitation_sum: [24.3, 0], precipitation_probability_max: [80, 5], wind_speed_10m_max: [18, 12], et0_fao_evapotranspiration: [3.71, 4.02], shortwave_radiation_sum: [15.2, 18], uv_index_max: [6.1, 7] },
    };
    const w = shapeOpenMeteo(m as never, 'Tenali');
    expect(w.current).toMatchObject({ temp: 29, condition: 'Clouds', humidity: 66 });
    expect(w.observed_at).toBe('2026-11-22T04:45:00.000Z');
    expect(w.daily[0]).toMatchObject({ max: 32, rain_mm: 24.3, et0_mm: 3.7, condition: 'Rain' });
    expect(w.hourly).toHaveLength(48);
    expect(w.soil_moisture_estimate?.top_1cm_pct).toBe(21.4);
    expect(w.advisories).toEqual([{ kind: 'heavy_rain', date: '2026-11-22', value: 24.3 }]);
  });
});

describe('NASA POWER + SoilGrids', () => {
  it('rolls hourly up to days and skips fill values', () => {
    const P: Record<string, Record<string, number>> = { T2M: {}, RH2M: {}, PRECTOTCORR: {}, ALLSKY_SFC_SW_DWN: {}, WS2M: {} };
    for (let hr = 0; hr < 24; hr++) {
      const k = `20261101${String(hr).padStart(2, '0')}`;
      P.T2M[k] = 20 + hr / 2; P.RH2M[k] = 70; P.PRECTOTCORR[k] = hr < 4 ? 1 : 0; P.ALLSKY_SFC_SW_DWN[k] = hr >= 6 && hr < 18 ? 500 : 0; P.WS2M[k] = 2;
      P.T2M[`20261102${String(hr).padStart(2, '0')}`] = -999;  // all missing
    }
    const days = powerHourlyToDaily({ properties: { parameter: P as never } });
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: '2026-11-01', temp_min: 20, temp_max: 31.5, rain_mm: 4, solar_kwh_m2: 6 });
    expect(climateSummary(days)).toMatchObject({ rain_total_mm: 4, rainy_days: 1 });
  });
  it('converts SoilGrids mapped units and classifies texture', () => {
    const layers = shapeSoilGrids({ properties: { layers: [{ name: 'phh2o', unit_measure: { d_factor: 10, target_units: '-' }, depths: [{ label: '0-5cm', values: { mean: 69 } }] }] } });
    expect(layers[0].depths[0].value).toBe(6.9);
    expect(textureClass(35, 29, 36)).toBe('clay_loam');
    expect(textureClass(88, 7, 5)).toBe('sand');
    expect(textureClass(40, 40, 20)).toBe('loam');
  });
});

describe('market', () => {
  it('parses both data.gov.in field styles and rejects broken rows', () => {
    expect(isoDate('05/11/2026')).toBe('2026-11-05');
    const a = parseRecord({ state: 'Andhra Pradesh', district: 'Guntur', market: 'Tenali', commodity: 'Maize', variety: 'Hybrid', grade: 'FAQ', arrival_date: '05/11/2026', min_price: '2020', max_price: '2310', modal_price: '2180' });
    const b = parseRecord({ State: 'Andhra Pradesh', District: 'Guntur', Market: 'Tenali', Commodity: 'Maize', Variety: 'Hybrid', Grade: 'FAQ', Arrival_Date: '2026-11-05', Min_Price: 2020, Max_Price: 2310, Modal_Price: 2180 });
    expect(a).toEqual(b);
    expect(a?.modal_price).toBe(2180);
    expect(parseRecord({ state: 'X', market: 'Y', commodity: 'Z', arrival_date: '01/01/2026', min_price: 100, max_price: 200, modal_price: 900 })).toBeNull();
  });
  it('builds a price band from past seasons, never one number', () => {
    const stats = [
      { yr: 2023, mon: 11, modal_avg: 2000 }, { yr: 2023, mon: 2, modal_avg: 2200 },
      { yr: 2024, mon: 11, modal_avg: 2100 }, { yr: 2024, mon: 2, modal_avg: 2100 },
      { yr: 2025, mon: 11, modal_avg: 2000 }, { yr: 2025, mon: 2, modal_avg: 2400 },
      { yr: 2026, mon: 11, modal_avg: 9999 },  // current year ignored
    ];
    const o = harvestOutlook(stats, 2180, 11, 2, 2026);
    expect(o.enough_history).toBe(true);
    if (!o.enough_history) return;
    expect([o.price_low, o.price_mid, o.price_high]).toEqual([2180, 2398, 2616]);
    expect(o.years_used).toBe(3);
    expect(['low', 'medium', 'high']).toContain(o.uncertainty);
    expect(harvestOutlook(stats.slice(0, 2), 2180, 11, 2, 2026).enough_history).toBe(false);
  });
  it('summarises mandis and builds a median daily series', () => {
    const r = (market: string, d: string, p: number) => ({ state: 'AP', district: 'G', market, commodity: 'Maize', variety: '', grade: '', arrival_date: d, min_price: p - 100, max_price: p + 100, modal_price: p });
    const rows = [r('Tenali', '2026-11-12', 2180), r('Tenali', '2026-11-05', 2100), r('Guntur', '2026-11-12', 2140), r('Duggirala', '2026-11-12', 2095)];
    expect(marketSummary(rows)[0]).toMatchObject({ market: 'Tenali', modal_price: 2180, change_7d: 80 });
    expect(dailySeries(rows).at(-1)).toMatchObject({ date: '2026-11-12', modal: 2140, markets: 3 });
  });
});

describe('IoT', () => {
  const types = new Map([['water_do', { code: 'water_do', unit: 'mg/L', min_valid: 0, max_valid: 30 }], ['water_ph', { code: 'water_ph', unit: 'pH', min_valid: 0, max_valid: 14 }]]);
  const ch = (channel: string, sensor_type: string, extra = {}) => ({ channel, kind: 'sensor' as const, sensor_type, enabled: true, calibration_offset: 0, calibration_scale: 1, max_run_s: null, ...extra });
  it('accepts only channels the hardware has, calibrates, and rejects impossible values', () => {
    const now = Date.parse('2026-11-22T10:00:00Z');
    const v = validateReadings({ readings: [{ s: 'do', v: 6 }, { s: 'ph', v: 15 }, { s: 'nh3', v: 1 }, { s: 'do', v: 'x' }, { s: 'do', v: 5, t: now / 1000 + 3600 }] },
      [ch('do', 'water_do', { calibration_offset: 0.4 }), ch('ph', 'water_ph')], types, now);
    expect(v.accepted).toEqual([{ sensor_type: 'water_do', value: 6.4, raw_value: 6, recorded_at: '2026-11-22T10:00:00.000Z' }]);
    expect(v.rejected.map((r) => r.reason)).toEqual(['out_of_range', 'unknown_channel', 'not_a_number', 'bad_time']);
  });
  it('thresholds, rules, geofence, snapshot', () => {
    expect(breach({ sensor_type: 'water_do', min_value: 4, max_value: null }, 3.2)).toEqual({ kind: 'low', limit: 4 });
    expect(breach({ sensor_type: 'water_do', min_value: 4, max_value: null }, 5)).toBeNull();
    const rule = { id: 'r', sensor_type: 'soil_moisture', operator: '<' as const, threshold: 20, cooldown_min: 30, last_fired_at: null };
    expect(ruleFires(rule, 15)).toBe(true);
    expect(ruleFires({ ...rule, last_fired_at: new Date().toISOString() }, 15)).toBe(false);
    const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
    expect(insidePolygon(0.5, 0.5, sq)).toBe(true);
    expect(insidePolygon(1.5, 0.5, sq)).toBe(false);
    const latest = latestByType([{ sensor_type: 'water_do', value: 5, raw_value: 5, recorded_at: '2026-11-22T10:00:00Z' }, { sensor_type: 'battery', value: 80, raw_value: 80, recorded_at: '2026-11-22T10:00:00Z' }]);
    expect(wqSnapshot(latest)).toEqual({ dissolved_oxygen_mgl: 5, recorded_at: '2026-11-22T10:00:00Z' });
  });
  it('alert text in three languages, simulated is always labelled', () => {
    expect(alertText('low', 'en', { p: 'water_do', v: 3.1, l: 4 })).toBe('Dissolved oxygen low: 3.1 (limit 4)');
    expect(alertText('low', 'te', { p: 'water_do', v: 3.1, l: 4 }, true)).toBe('కరిగిన ఆక్సిజన్ తక్కువ: 3.1 (పరిమితి 4) (సిమ్యులేటెడ్)');
    expect(alertText('offline', 'hi', { d: 'Pond node' })).toBe('Pond node ऑफ़लाइन है');
  });
  it('simulator stays in plausible ranges and scenarios trigger', () => {
    const at = new Date('2026-11-22T00:00:00Z');
    for (let i = 0; i < 50; i++) expect(simulateValue('water_do', at)).toBeGreaterThan(3.5);
    expect(simulateValue('water_do', at, 'low_oxygen')).toBeLessThan(4);
    expect(simulateValue('water_ph', at, 'sensor_fault')).toBeGreaterThan(14);
  });
});
