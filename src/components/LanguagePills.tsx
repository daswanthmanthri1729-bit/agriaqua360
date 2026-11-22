import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { LANGUAGES } from '@/locales';
import { useLanguage } from '@/hooks/useLanguage';
import { colors, radius } from '@/theme';

// Segmented EN / తెలుగు / हिन्दी switcher from the Stitch splash + login headers.
export function LanguagePills({ dark }: { dark?: boolean }) {
  const { t } = useTranslation();
  const { language, change } = useLanguage();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('language.title')} style={[styles.wrap, { backgroundColor: dark ? 'rgba(0,0,0,0.25)' : colors.surfaceContainer }]}>
      {LANGUAGES.map((l) => {
        const active = l.code === language;
        return (
          <Pressable
            key={l.code}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={l.english}
            onPress={() => change(l.code)}
            style={[styles.pill, active && { backgroundColor: dark ? colors.mint : colors.primaryDeep }]}
          >
            <AppText variant="labelLg" color={active ? (dark ? colors.primaryDark : colors.white) : dark ? colors.mint : colors.textMuted}>
              {l.short}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: radius.full, padding: 4 },
  pill: { minHeight: 40, minWidth: 48, paddingHorizontal: 12, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
