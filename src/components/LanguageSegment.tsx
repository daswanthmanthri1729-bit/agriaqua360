import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { LANGUAGES } from '@/locales';
import { useLanguage } from '@/hooks/useLanguage';
import { colors, radius } from '@/theme';

// Full-width variant used in forms (Stitch registration "Preferred Language" block).
export function LanguageSegment() {
  const { language, change } = useLanguage();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {LANGUAGES.map((l) => {
        const on = l.code === language;
        return (
          <Pressable key={l.code} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={l.english}
            onPress={() => change(l.code)} style={[styles.item, on && { backgroundColor: colors.primaryDeep }]}>
            {on && <Icon name="check" size={16} color={colors.white} />}
            <AppText variant="labelLg" color={on ? colors.white : colors.textMuted}>{l.native}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  item: { flex: 1, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.surfaceHigh, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
});
