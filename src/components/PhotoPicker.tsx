import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Banner } from './Banner';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { PermissionDeniedError, PickedImage, pickImages } from '@/services/media';
import { colors, radius } from '@/theme';

// Multi-photo picker with preview + remove. Images are already compressed by pickImages().
export function PhotoPicker({ value, onChange, max = 1, label }: { value: PickedImage[]; onChange: (v: PickedImage[]) => void; max?: number; label: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = async (source: 'camera' | 'library') => {
    setOpen(false); setError(null);
    try {
      const imgs = await pickImages(source, { multiple: max > 1 });
      onChange([...value, ...imgs].slice(0, max));
    } catch (e) {
      setError(e instanceof PermissionDeniedError ? 'profileSetup.photoPermission' : 'errors.generic');
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="labelLg">{label}</AppText>
      <View style={styles.grid}>
        {value.map((img, i) => (
          <View key={img.uri} style={styles.tile}>
            <Image source={{ uri: img.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={`${label} ${i + 1}`} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.remove')} hitSlop={8} style={styles.remove}
              onPress={() => onChange(value.filter((_, j) => j !== i))}>
              <Icon name="close" size={18} color={colors.white} />
            </Pressable>
          </View>
        ))}
        {value.length < max && (
          <Pressable accessibilityRole="button" accessibilityLabel={t('scan.addPhoto')} onPress={() => setOpen(true)} style={[styles.tile, styles.add]}>
            <Icon name="add-a-photo" size={28} color={colors.primary} />
            <AppText variant="labelMd" color={colors.primary}>{t('scan.addPhoto')}</AppText>
          </Pressable>
        )}
      </View>
      {error && <Banner tone="warning" message={t(error)} onDismiss={() => setError(null)} />}
      <Sheet visible={open} onClose={() => setOpen(false)}>
        <AppText variant="headlineSm">{label}</AppText>
        <Button variant="tonal" iconLeft="photo-camera" label={t('scan.camera')} onPress={() => pick('camera')} />
        <Button variant="tonal" iconLeft="photo-library" label={t('scan.gallery')} onPress={() => pick('library')} />
        <Button variant="text" label={t('common.cancel')} onPress={() => setOpen(false)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: 100, height: 100, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceHigh },
  add: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.secondary, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.surfaceLow },
  remove: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
});
