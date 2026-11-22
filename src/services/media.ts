import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

export type PickedImage = { uri: string; width: number; height: number };
export type MediaFolder = 'profiles' | 'farms' | 'crops' | 'ponds' | 'livestock' | 'scans' | 'assistant';
export class PermissionDeniedError extends Error {}

// 1280 px / q0.6 keeps leaf lesions and fish spots clear for AI while halving upload size on 2G/3G.
const MAX_EDGE = 1280;

// Resize + JPEG-compress before upload: farm networks are slow and phone photos are 4–12 MB.
export async function compress(img: PickedImage): Promise<PickedImage> {
  const ctx = ImageManipulator.manipulate(img.uri);
  if (Math.max(img.width, img.height) > MAX_EDGE) {
    ctx.resize(img.width >= img.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
  return { uri: out.uri, width: out.width, height: out.height };
}

export async function pickImages(source: 'camera' | 'library', opts: { multiple?: boolean; square?: boolean } = {}): Promise<PickedImage[]> {
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new PermissionDeniedError();
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: !!opts.square && !opts.multiple,
    aspect: opts.square ? [1, 1] : undefined,
    allowsMultipleSelection: !!opts.multiple && source === 'library',
    selectionLimit: opts.multiple ? 5 : 1,
  };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (res.canceled) return [];
  return Promise.all(res.assets.map((a) => compress({ uri: a.uri, width: a.width, height: a.height })));
}

// Path layout `<folder>/<userId>/<file>` is what the storage RLS policies key on.
export function uploadImage(bucket: 'avatars' | 'media', folder: MediaFolder, userId: string, img: PickedImage): Promise<string> {
  return uploadFile(bucket, folder, userId, img.uri, 'image/jpeg', 'jpg');
}

export async function uploadFile(bucket: 'avatars' | 'media', folder: MediaFolder, userId: string, uri: string, contentType: string, ext: string): Promise<string> {
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

export async function signedUrl(bucket: 'avatars' | 'media', path: string, seconds = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
