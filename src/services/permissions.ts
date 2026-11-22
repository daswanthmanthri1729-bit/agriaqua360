import { Platform } from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import type { IconName } from '@/components';

export type PermissionKey = 'camera' | 'photos' | 'microphone' | 'location' | 'notifications';
export type PermissionState = 'granted' | 'denied' | 'undetermined';
type Res = { granted: boolean; canAskAgain?: boolean; status: string };

const norm = (r: Res): PermissionState => (r.granted ? 'granted' : r.status === 'denied' ? 'denied' : 'undetermined');

// Android 13+ shows the notification prompt only after a channel exists.
export async function ensureNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'AgriAqua 360',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#176B45',
  });
}

export const PERMISSIONS: { key: PermissionKey; icon: IconName; get: () => Promise<Res>; request: () => Promise<Res> }[] = [
  { key: 'camera', icon: 'photo-camera', get: Camera.getCameraPermissionsAsync, request: Camera.requestCameraPermissionsAsync },
  { key: 'photos', icon: 'photo-library', get: () => ImagePicker.getMediaLibraryPermissionsAsync(), request: () => ImagePicker.requestMediaLibraryPermissionsAsync() },
  { key: 'microphone', icon: 'mic', get: getRecordingPermissionsAsync, request: requestRecordingPermissionsAsync },
  { key: 'location', icon: 'location-on', get: Location.getForegroundPermissionsAsync, request: Location.requestForegroundPermissionsAsync },
  {
    key: 'notifications', icon: 'notifications-active',
    get: () => Notifications.getPermissionsAsync(),
    request: async () => { await ensureNotificationChannel(); return Notifications.requestPermissionsAsync(); },
  },
];

export async function readPermission(p: (typeof PERMISSIONS)[number]): Promise<PermissionState> {
  try { return norm(await p.get()); } catch { return 'undetermined'; }
}
export async function askPermission(p: (typeof PERMISSIONS)[number]): Promise<PermissionState> {
  try { return norm(await p.request()); } catch { return 'denied'; }
}
