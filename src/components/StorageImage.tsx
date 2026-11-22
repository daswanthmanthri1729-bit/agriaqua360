import { Image, ImageStyle } from 'expo-image';
import { View, ViewStyle } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { signedUrl } from '@/services/media';
import { Icon, IconName } from './Icon';
import { colors } from '@/theme';

// Private-bucket image. Cached on disk under its storage path (signed URLs change, so the URL can't be the key);
// a cached photo opens from disk without asking the server for a new signed URL. Falls back to an icon tile.
export function StorageImage({ path, bucket = 'media', style, fallback = 'image', label }: { path: string | null | undefined; bucket?: 'media' | 'avatars'; style: ImageStyle & ViewStyle; fallback?: IconName; label?: string }) {
  const cacheKey = path ? `${bucket}/${path}` : '';
  const { data } = useQuery({
    queryKey: ['signed', bucket, path], enabled: !!path, staleTime: 50 * 60_000,
    queryFn: async () => {
      const cached = await Image.getCachePathAsync(cacheKey).catch(() => null);
      return cached ? (cached.startsWith('file://') ? cached : `file://${cached}`) : signedUrl(bucket, path!);
    },
  });
  if (!data) {
    return <View style={[style, { backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }]}><Icon name={fallback} size={32} color={colors.primary} /></View>;
  }
  return <Image source={{ uri: data, cacheKey }} cachePolicy="disk" style={style} contentFit="cover" transition={150} accessibilityLabel={label} />;
}
