// 03 · Language Selection — Stitch: 05_language_selection_screen
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Header, Icon, Screen } from '@/components';
import { LANGUAGES, Language } from '@/locales';
import i18n from '@/locales';
import { useLanguage } from '@/hooks/useLanguage';
import { usePreferences } from '@/store/preferences';
import { colors, fonts, radius } from '@/theme';

export default function LanguageSelection() {
  const { t } = useTranslation();
  const { language, change } = useLanguage();
  const setLanguage = usePreferences((s) => s.setLanguage);
  const [speaking, setSpeaking] = useState<Language | null>(null);
  const [voiceError, setVoiceError] = useState(false);

  // Devices differ in installed TTS voices; check before speaking and tell the farmer if missing.
  const listen = async (code: Language, speechTag: string) => {
    setVoiceError(false);
    Speech.stop();
    const voices = await Speech.getAvailableVoicesAsync().catch(() => []);
    const prefix = speechTag.slice(0, 2);
    if (voices.length > 0 && !voices.some((v) => v.language?.toLowerCase().startsWith(prefix))) {
      setVoiceError(true);
      return;
    }
    setSpeaking(code);
    Speech.speak(i18n.getFixedT(code)('language.sample'), {
      language: speechTag,
      rate: 0.9,
      onDone: () => setSpeaking(null),
      onStopped: () => setSpeaking(null),
      onError: () => { setSpeaking(null); setVoiceError(true); },
    });
  };

  const next = () => {
    Speech.stop();
    setLanguage(language);
    router.push('/onboarding/permissions');
  };

  return (
    <Screen footer={<Button testID="language-continue" label={t('language.continueIn')} icon="arrow-forward" onPress={next} />}>
      <Header />
      <View style={{ gap: 6 }}>
        <AppText variant="display" accessibilityRole="header">{t('language.title')}</AppText>
        <AppText variant="bodyLg" color={colors.textMuted}>{t('language.subtitle')}</AppText>
      </View>
      <View accessibilityRole="radiogroup" style={{ gap: 12 }}>
        {LANGUAGES.map((l) => {
          const active = l.code === language;
          const ft = i18n.getFixedT(l.code);
          return (
            <Pressable
              key={l.code}
              testID={`lang-${l.code}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${l.native} (${l.english})`}
              onPress={() => change(l.code)}
              style={[styles.card, active && styles.cardActive]}
            >
              <View style={[styles.glyph, active && { backgroundColor: colors.primaryDeep }]}>
                <AppText style={styles.glyphText} color={active ? colors.white : colors.primaryDeep}>{l.glyph}</AppText>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="headlineSm">{l.native}{l.code !== 'en' ? `  (${l.english})` : ''}</AppText>
                <AppText variant="bodySm" color={colors.textMuted} numberOfLines={2}>{ft('language.tagline')}</AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${ft('language.listen')} ${l.english}`}
                  hitSlop={8}
                  onPress={() => listen(l.code, l.speech)}
                  style={styles.listen}
                >
                  <Icon name={speaking === l.code ? 'graphic-eq' : 'volume-up'} size={18} color={colors.ai} />
                  <AppText variant="labelLg" color={colors.ai}>{ft('language.listen')}</AppText>
                </Pressable>
              </View>
              <View style={[styles.check, active && { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep }]}>
                {active && <Icon name="check" size={18} color={colors.white} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      {voiceError && <Banner tone="warning" message={t('language.voiceUnavailable')} onDismiss={() => setVoiceError(false)} />}
      <View style={styles.note}>
        <Icon name="info-outline" size={18} color={colors.textSubtle} />
        <AppText variant="bodySm" color={colors.textSubtle} style={{ flex: 1 }}>{t('language.changeLater')}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  cardActive: { borderWidth: 2, borderColor: colors.primary, backgroundColor: '#F4FBF7' },
  glyph: { width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  glyphText: { fontFamily: fonts.headingBold, fontSize: 24, lineHeight: 34 },
  listen: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, minHeight: 32 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
});
