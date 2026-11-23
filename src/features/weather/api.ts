import { usePreferences } from '@/store/preferences';
import { useSession } from '@/store/session';
import { useQuery } from '@tanstack/react-query';
import { invoke } from '@/lib/query';

export type WeatherQuery = { lat: number; lon: number; name?: string } | { city: string };
export type Weather = {
  location: { name: string; lat: number; lon: number };
  observed_at: string;
  current: { temp: number; feels_like: number; humidity: number; wind_kmh: number; rain_1h_mm: number; condition: string; icon: string; pop_today: number };
  daily: { date: string; min: number; max: number; pop: number; rain_mm: number; condition: string; icon: string; wind_kmh: number; et0_mm?: number; solar_mj?: number; uv?: number }[];
  advisories: { kind: 'heavy_rain' | 'heat' | 'strong_wind' | 'cold'; date: string; value: number }[];
  // Level 2 (Open-Meteo); absent when the OpenWeather fallback answered.
  source?: 'open-meteo' | 'openweather';
  hourly?: { time: string; temp: number; humidity: number; pop: number; rain_mm: number; wind_kmh: number; condition: string; icon: string }[];
  soil_moisture_estimate?: { top_1cm_pct: number; cm_3_9_pct: number | null } | null;
  fetched_at?: string;
  cached?: boolean;
};

export const useWeather = (q: WeatherQuery | null) =>
  useQuery({
    queryKey: ['weather', q],
    enabled: !!q,
    staleTime: 15 * 60_000,
    queryFn: () => invoke<Weather>('weather', q!),
  });

const ICONS: Record<string, string> = {
  Clear: 'wb-sunny', Clouds: 'cloud', Rain: 'umbrella', Drizzle: 'grain', Thunderstorm: 'thunderstorm', Snow: 'ac-unit',
};
export const conditionIcon = (c: string) => ICONS[c] ?? 'foggy';
export const conditionKey = (c: string) => `weather.cond.${ICONS[c] ? c : 'Mist'}`;

/** Where to fetch weather for: manual pick > profile GPS > profile village name. */
export function useWeatherTarget(): WeatherQuery | null {
  const manual = usePreferences((s) => s.weatherPlace);
  const profile = useSession((s) => s.profile);
  if (manual) return manual;
  if (profile?.latitude != null && profile.longitude != null) return { lat: profile.latitude, lon: profile.longitude, name: profile.village ?? undefined };
  // OpenWeather reads a middle part as a US state code, so send only village + country.
  if (profile?.village) return { city: `${profile.village},IN` };
  return null;
}
