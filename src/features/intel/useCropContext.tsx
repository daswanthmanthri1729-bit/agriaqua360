import { useState } from 'react';
import { ChoiceChips } from '@/components';
import { useCrops, useFarms } from '@/features/agriculture/api';
import { useWeather } from '@/features/weather/api';
import { useSession } from '@/store/session';
import { farmPoint } from './place';

/** Selected growing crop (or ?crop= param) with its farm, location and weather — shared by crop screens. */
export function useCropContext(initialCropId?: string, includeAll = false) {
  const profile = useSession((s) => s.profile);
  const crops = useCrops(); const farms = useFarms();
  const list = (crops.data ?? []).filter((c) => includeAll || c.status === 'growing' || c.status === 'planned');
  const [id, setId] = useState<string | null>(initialCropId ?? null);
  const crop = list.find((c) => c.id === id) ?? list[0];
  const farm = farms.data?.find((f) => f.id === crop?.farm_id) ?? farms.data?.[0];
  const pt = farmPoint(farm, profile);
  const weather = useWeather(pt ? { lat: pt.lat, lon: pt.lon, name: farm?.village ?? undefined } : null);
  const picker = list.length > 1 ? <ChoiceChips scroll value={crop?.id ?? null} onChange={setId} options={list.map((c) => ({ value: c.id, label: c.name }))} /> : null;
  return { loading: crops.isLoading || farms.isLoading, crops: list, crop, farm, pt, weather, picker };
}
