import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { SECTORS, Sector } from '@/features/auth/schemas';
import { colors, radius, shadow } from '@/theme';

const ICONS: Record<Sector, IconName> = { agriculture: 'grass', aquaculture: 'water-drop', livestock: 'pets' };

export function SectorPicker({ value, onChange }: { value: Sector[]; onChange: (v: Sector[]) => void }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 12 }}>
      {SECTORS.map((s) => {
        const on = value.includes(s);
        return (
          <Pressable key={s} testID={`sector-${s}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
            accessibilityLabel={t(`sectors.${s}`)}
            onPress={() => onChange(on ? value.filter((v) => v !== s) : [...value, s])}
            style={[styles.card, on && styles.on]}>
            <View style={[styles.icon, on && { backgroundColor: colors.primaryDeep }]}>
              <Icon name={ICONS[s]} size={28} color={on ? colors.white : colors.primaryDeep} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="headlineSm">{t(`sectors.${s}`)}</AppText>
              <AppText variant="bodySm" color={colors.textMuted} numberOfLines={2}>{t(`sectors.${s}Desc`)}</AppText>
            </View>
            <View style={[styles.tick, on && { backgroundColor: colors.primaryDeep }]}>
              {on && <Icon name="check" size={18} color={colors.white} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  on: { borderColor: colors.primary, borderWidth: 2 },
  icon: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
});
