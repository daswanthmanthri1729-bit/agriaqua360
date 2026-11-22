import { Image, ImageStyle } from 'expo-image';
import { View, ViewStyle } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { signedUrl } from '@/services/media';
import { Icon, IconName } from './Icon';
import { colors } from '@/theme';

// Private-bucket image via short-lived signed URL; falls back to an icon tile.
export function StorageImage({ path, bucket = 'media', style, fallback = 'image', label }: { path: string | null | undefined; bucket?: 'media' | 'avatars'; style: ImageStyle & ViewStyle; fallback?: IconName; label?: string }) {
  const { data } = useQuery({ queryKey: ['signed', bucket, path], enabled: !!path, staleTime: 50 * 60_000, queryFn: () => signedUrl(bucket, path!) });
  if (!data) {
    return <View style={[style, { backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' }]}><Icon name={fallback} size={32} color={colors.primary} /></View>;
  }
  return <Image source={{ uri: data }} style={style} contentFit="cover" transition={150} accessibilityLabel={label} />;
}
