// 40 · Help and Support — Stitch: 51_expert_consultation_support (helplines + guidance)
import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Header, Icon, Screen, SectionHeader } from '@/components';
import { colors } from '@/theme';

// Public, toll-free Government of India helplines.
const HELPLINES = [
  { key: 'kisan', number: '18001801551', display: '1800-180-1551', icon: 'agriculture' as const },
  { key: 'animal', number: '1962', display: '1962', icon: 'pets' as const },
];
const FAQ = ['1', '2', '3', '4', '5', '6'];

export default function Help() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Screen>
      <Header title={t('help.title')} />
      <SectionHeader title={t('help.helplines')} />
      {HELPLINES.map((h) => (
        <Card key={h.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name={h.icon} size={28} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="labelLg">{t(`help.${h.key}`)}</AppText>
            <AppText variant="headlineSm">{h.display}</AppText>
            <AppText variant="bodySm" color={colors.textMuted}>{t(`help.${h.key}Desc`)}</AppText>
          </View>
          <Button compact iconLeft="call" label={t('help.call')} onPress={() => Linking.openURL(`tel:${h.number}`).catch(() => {})} />
        </Card>
      ))}
      <SectionHeader title={t('help.faq')} />
      <Card style={{ paddingVertical: 4 }}>
        {FAQ.map((k) => (
          <View key={k} style={{ borderBottomWidth: k === '6' ? 0 : 1, borderBottomColor: colors.border }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === k }} onPress={() => setOpen(open === k ? null : k)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56 }}>
              <AppText variant="labelLg" style={{ flex: 1 }}>{t(`help.q${k}`)}</AppText>
              <Icon name={open === k ? 'expand-less' : 'expand-more'} color={colors.textMuted} />
            </Pressable>
            {open === k && <AppText variant="bodyMd" color={colors.textMuted} style={{ paddingBottom: 14 }}>{t(`help.a${k}`)}</AppText>}
          </View>
        ))}
      </Card>
      <Banner tone="ai" title={t('help.aiTitle')} message={t('help.aiText')} />
    </Screen>
  );
}
