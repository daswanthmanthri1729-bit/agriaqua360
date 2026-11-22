import type { Farm, Profile } from '@/types/database';
import { centroid } from '@/components/TileMap';

/** Best location for a farm: its GPS point, else its boundary centre, else the farmer's profile location. */
export function farmPoint(farm: Pick<Farm, 'latitude' | 'longitude' | 'boundary'> | undefined | null, profile?: Pick<Profile, 'latitude' | 'longitude'> | null) {
  if (farm?.latitude != null && farm.longitude != null) return { lat: farm.latitude, lon: farm.longitude };
  if (farm?.boundary && farm.boundary.length >= 3) return centroid(farm.boundary);
  if (profile?.latitude != null && profile.longitude != null) return { lat: profile.latitude, lon: profile.longitude };
  return null;
}
