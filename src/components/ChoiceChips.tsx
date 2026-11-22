import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { colors, radius } from '@/theme';

type Opt<T extends string> = { value: T; label: string; icon?: IconName };
type Props<T extends string> = { options: Opt<T>[]; value: T | null; onChange: (v: T) => void; scroll?: boolean; label?: string; error?: string };

// Single-select pill chips (filters, enums). Pill shape per DESIGN.md "Chips & Status Badges".
export function ChoiceChips<T extends string>({ options, value, onChange, scroll, label, error }: Props<T>) {
  const chips = options.map((o) => {
    const on = o.value === value;
    return (
      <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={o.label}
        onPress={() => onChange(o.value)} style={[styles.chip, on && styles.on]}>
        {o.icon && <Icon name={o.icon} size={18} color={on ? colors.white : colors.primaryDeep} />}
        <AppText variant="labelLg" color={on ? colors.white : colors.textMuted}>{o.label}</AppText>
      </Pressable>
    );
  });
  return (
    <View style={{ gap: 8 }}>
      {label && <AppText variant="labelLg">{label}</AppText>}
      {scroll ? (
        <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="radiogroup">{chips}</ScrollView>
      ) : (
        <View style={[styles.row, { flexWrap: 'wrap' }]} accessibilityRole="radiogroup">{chips}</View>
      )}
      {error && <AppText variant="bodySm" color={colors.error}>{error}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 6 },
  on: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
});
