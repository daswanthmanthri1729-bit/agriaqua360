import { useOfflineInsert } from '@/hooks/useOfflineInsert';
// Level 2 intelligence data: market prices, harvest outlook, AI insights, NASA/SoilGrids, satellite, finance, schemes.
import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invoke, must, queryClient } from '@/lib/query';
import i18n from '@/locales';
import type { FarmTransaction, FinanceRow, PriceAlert, SatelliteObservation, Scheme, SchemeTracking, SoilTest } from '@/types/database';

const invalidate = (...keys: string[]) => Promise.all(keys.map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
const HOUR = 3600_000;

// ---------- market ----------
export type MarketRow = { state: string; district: string; market: string; variety: string; arrival_date: string; min_price: number | null; max_price: number | null; modal_price: number | null; change_7d: number | null };
export type MarketPrices = { configured: boolean; warning: string | null; source: string; commodity: string; unit: string; last_updated: string | null; markets: MarketRow[]; series: { date: string; modal: number; min: number; max: number; markets: number }[] };
export const useMarketPrices = (commodity: string | null, state: string | null, days = 30) =>
  useQuery({
    queryKey: ['market', commodity, state, days],
    enabled: !!commodity,
    staleTime: HOUR,
    queryFn: () => invoke<MarketPrices>('market', { action: 'prices', commodity, state: state ?? '', days }),
  });
export const useCommodities = (q: string) =>
  useQuery({ queryKey: ['commodities', q], staleTime: 6 * HOUR, queryFn: () => invoke<{ configured: boolean; commodities: string[] }>('market', { action: 'commodities', q }) });

export type Outlook = {
  configured: boolean; warning: string | null; source?: string; enough_history: boolean; reason?: string; current_price?: number; harvest_month?: number; years_used?: number;
  scenarios?: { year: number; ratio: number; price: number }[]; price_low?: number; price_mid?: number; price_high?: number; uncertainty?: 'low' | 'medium' | 'high';
  revenue?: { quantity_qtl: number; low: number; mid: number; high: number } | null; factors?: { summary: string; increase_factors: string[]; decrease_factors: string[] } | null;
};
export const useOutlook = () =>
  useMutation({ mutationFn: (p: { commodity: string; state: string; harvest_month: number; quantity_qtl?: number; crop_id?: string }) => invoke<Outlook>('market', { action: 'outlook', ...p, language: i18n.language }) });

export const usePriceAlerts = () => useQuery({ queryKey: ['priceAlerts'], queryFn: () => must<PriceAlert[]>(supabase.from('price_alerts').select('*').order('created_at', { ascending: false })) });
export const useSavePriceAlert = () =>
  useMutation({ mutationFn: (a: Omit<PriceAlert, 'id' | 'last_triggered_at' | 'enabled'>) => must(supabase.from('price_alerts').insert(a)), onSuccess: () => invalidate('priceAlerts') });
export const useDeletePriceAlert = () => useMutation({ mutationFn: (id: string) => must(supabase.from('price_alerts').delete().eq('id', id)), onSuccess: () => invalidate('priceAlerts') });

// ---------- AI insights (cached server-side until the data changes) ----------
export type Insight = { status: 'good' | 'watch' | 'act'; summary: string; findings: string[]; actions: string[]; see_expert: boolean; data_used: string[]; generated_at: string; cached: boolean };
export const useInsight = (kind: 'water' | 'soil' | 'crop' | 'livestock' | 'finance', id: string | null, extra?: unknown, enabled = false) =>
  useQuery({
    queryKey: ['insight', kind, id, i18n.language],
    enabled: enabled && (kind === 'finance' || !!id),
    staleTime: 30 * 60_000,
    retry: 0,
    queryFn: () => invoke<Insight>('insights', { kind, id, language: i18n.language, extra }),
  });

// ---------- environment ----------
export type ClimateDay = { date: string; temp_min: number | null; temp_max: number | null; temp_avg: number | null; humidity_avg: number | null; rain_mm: number | null; solar_kwh_m2: number | null; wind_ms_avg: number | null };
export type ClimateSummary = { days_with_data: number; rain_total_mm: number | null; rainy_days: number; temp_avg: number | null; temp_max: number | null; temp_min: number | null };
export type History = { source: string; days: ClimateDay[]; summary: ClimateSummary; last_year_summary: ClimateSummary | null; data_until: string | null; fetched_at: string; cached: boolean };
export const useClimateHistory = (lat: number | null | undefined, lon: number | null | undefined, days = 30) =>
  useQuery({ queryKey: ['climate', lat, lon, days], enabled: lat != null && lon != null, staleTime: 6 * HOUR, queryFn: () => invoke<History>('environment', { kind: 'history', lat, lon, days }) });

export type SoilEstimate = { source: string; layers: { property: string; unit: string; depths: { depth: string; value: number | null }[] }[]; texture: string | null; fetched_at: string };
export const useSoilEstimate = (lat: number | null | undefined, lon: number | null | undefined) =>
  useQuery({ queryKey: ['soilgrids', lat, lon], enabled: lat != null && lon != null, staleTime: 24 * HOUR, retry: 0, queryFn: () => invoke<SoilEstimate>('environment', { kind: 'soil', lat, lon }) });

// ---------- soil tests ----------
export const useSoilTests = (farmId: string | null) =>
  useQuery({ queryKey: ['soilTests', farmId], enabled: !!farmId, queryFn: () => must<SoilTest[]>(supabase.from('soil_tests').select('*').eq('farm_id', farmId!).order('tested_on', { ascending: false })) });
export const useAddSoilTest = () => useOfflineInsert('soil_tests', (s: Partial<SoilTest>) => s);
export const useDeleteSoilTest = () => useMutation({ mutationFn: (id: string) => must(supabase.from('soil_tests').delete().eq('id', id)), onSuccess: () => invalidate('soilTests') });

// ---------- satellite ----------
export type SatelliteResult = { configured: boolean; error?: string; provider?: string; area_ha?: number; observations?: SatelliteObservation[]; fetched_at?: string };
export const useSatellite = (farmId: string | null, enabled: boolean) =>
  useQuery({ queryKey: ['satellite', farmId], enabled: !!farmId && enabled, staleTime: 6 * HOUR, retry: 0, queryFn: () => invoke<SatelliteResult>('satellite', { action: 'refresh', farm_id: farmId }) });
export const useNdviImage = () => useMutation({ mutationFn: (p: { farmId: string; date: string }) => invoke<{ path: string }>('satellite', { action: 'image', farm_id: p.farmId, date: p.date }) });
export const useSaveBoundary = () =>
  useMutation({
    mutationFn: ({ farmId, boundary, area }: { farmId: string; boundary: [number, number][] | null; area: number | null }) =>
      must(supabase.from('farms').update({ boundary, boundary_area_ha: area }).eq('id', farmId)),
    onSuccess: () => invalidate('farms', 'satellite'),
  });

// ---------- finance ----------
export const EXPENSE_CATEGORIES = ['seed', 'fertilizer', 'pesticide', 'feed', 'labour', 'fuel', 'electricity', 'water', 'equipment', 'veterinary', 'transport', 'rent', 'loan_interest', 'other_expense'] as const;
export const INCOME_CATEGORIES = ['crop_sale', 'fish_sale', 'milk_sale', 'animal_sale', 'subsidy', 'insurance_claim', 'other_income'] as const;
export const useTransactions = (from: string, to: string) =>
  useQuery({ queryKey: ['tx', from, to], queryFn: () => must<FarmTransaction[]>(supabase.from('farm_transactions').select('*').gte('occurred_on', from).lte('occurred_on', to).order('occurred_on', { ascending: false }).limit(500)) });
export const useFinanceSummary = (from: string, to: string) =>
  useQuery({ queryKey: ['tx', 'summary', from, to], queryFn: () => must<FinanceRow[]>(supabase.rpc('finance_summary', { p_from: from, p_to: to })) });
export const useAddTransaction = () => useOfflineInsert('farm_transactions', (x: Partial<FarmTransaction>) => x);
export const useDeleteTransaction = () => useMutation({ mutationFn: (id: string) => must(supabase.from('farm_transactions').delete().eq('id', id)), onSuccess: () => invalidate('tx') });

// ---------- schemes ----------
export const useSchemes = () =>
  useQuery({
    queryKey: ['schemes'],
    staleTime: 24 * HOUR,
    queryFn: async () => {
      const [schemes, tracking] = await Promise.all([
        must<Scheme[]>(supabase.from('schemes').select('*').order('code')),
        must<SchemeTracking[]>(supabase.from('scheme_tracking').select('*')),
      ]);
      return { schemes, tracking };
    },
  });
export const useTrackScheme = () =>
  useMutation({
    mutationFn: ({ code, status, existing }: { code: string; status: SchemeTracking['status'] | null; existing?: SchemeTracking }) =>
      status == null ? must(supabase.from('scheme_tracking').delete().eq('id', existing!.id))
        : existing ? must(supabase.from('scheme_tracking').update({ status, applied_on: status === 'applied' ? new Date().toISOString().slice(0, 10) : existing.applied_on }).eq('id', existing.id))
          : must(supabase.from('scheme_tracking').insert({ scheme_code: code, status })),
    onSuccess: () => invalidate('schemes'),
  });

// ---------- irrigation log (stored as completed crop_records 'irrigation' entries, litres) ----------
export const useLogIrrigation = () =>
  useOfflineInsert('crop_records', (p: { crop_id: string; date: string; litres: number | null; notes?: string }) =>
    ({ crop_id: p.crop_id, activity: 'irrigation', scheduled_for: p.date, completed_at: new Date().toISOString(), quantity: p.litres, unit: p.litres != null ? 'L' : null, notes: p.notes || null }));
