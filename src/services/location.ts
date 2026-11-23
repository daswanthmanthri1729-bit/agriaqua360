import * as Location from 'expo-location';

export type Place = { latitude: number; longitude: number; village?: string; district?: string; state?: string };
export class LocationDeniedError extends Error {}

export async function currentPlace(): Promise<Place> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new LocationDeniedError();
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = pos.coords;
  const [addr] = await Location.reverseGeocodeAsync({ latitude, longitude }).catch(() => []);
  return {
    latitude, longitude,
    village: addr?.city ?? addr?.district ?? addr?.name ?? undefined,
    district: addr?.subregion ?? undefined,
    state: addr?.region ?? undefined,
  };
}

/** One precise GPS fix (no address lookup) — used to walk a field boundary corner by corner. */
export async function gpsPoint(): Promise<{ lat: number; lon: number; accuracy: number | null }> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new LocationDeniedError();
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
  return { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null };
}
