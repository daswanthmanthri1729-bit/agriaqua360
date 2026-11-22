import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Card, Chip, StorageImage } from '@/components';
import { today } from '@/lib/dates';
import type { Animal, AnimalStatus, Species } from '@/types/database';
import { colors, radius } from '@/theme';
import { ageMonths } from './vaccination';

export const SPECIES_EMOJI: Record<Species, string> = { cow: '🐄', buffalo: '🐃', sheep: '🐑', goat: '🐐', pig: '🐖' };
export const STATUS_TONE: Record<AnimalStatus, 'normal' | 'warning' | 'error' | 'ai'> = {
  healthy: 'normal', sick: 'error', under_treatment: 'warning', pregnant: 'ai', sold: 'normal', deceased: 'normal',
};

export function useAgeLabel() {
  const { t } = useTranslation();
  return (birth: string | null) => {
    const m = ageMonths(birth, today());
    if (m == null) return null;
    return m < 24 ? t('livestock.ageMonths', { count: m }) : t('livestock.ageYears', { years: Math.floor(m / 12), months: m % 12 });
  };
}

export const animalLabel = (a: Pick<Animal, 'name' | 'tag_id'>) => [a.name, a.tag_id && `#${a.tag_id}`].filter(Boolean).join(' ');

export function SpeciesAvatar({ species, size = 56 }: { species: Species; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} accessibilityElementsHidden>
      <AppText style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{SPECIES_EMOJI[species]}</AppText>
    </View>
  );
}

export function AnimalRow({ a, onPress }: { a: Animal; onPress: () => void }) {
  const { t } = useTranslation();
  const age = useAgeLabel()(a.birth_date);
  return (
    <Card onPress={onPress} accessibilityLabel={`${t(`livestock.species.${a.species}`)} ${animalLabel(a)}`} style={styles.row}>
      {a.photo_path ? <StorageImage path={a.photo_path} style={{ width: 56, height: 56, borderRadius: 28 }} fallback="pets" /> : <SpeciesAvatar species={a.species} />}
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="headlineSm" numberOfLines={1}>{animalLabel(a)}</AppText>
        <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>
          {[t(`livestock.species.${a.species}`), a.breed, a.sex && t(`livestock.${a.sex}`), age].filter(Boolean).join(' • ')}
        </AppText>
        <Chip tone={STATUS_TONE[a.status]} label={t(`livestock.statuses.${a.status}`)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
});
