import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { colors, radius } from '@/theme';

export type HubLink = { icon: IconName; label: string; href: string };
/** Two-column grid of shortcuts to related screens (labels are translation keys). */
export function HubLinks({ links }: { links: HubLink[] }) {
  const { t } = useTranslation();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {links.map((l) => (
        <Pressable key={l.href} accessibilityRole="button" accessibilityLabel={t(l.label)} onPress={() => router.push(l.href as never)}
          style={({ pressed }) => ({ flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, paddingHorizontal: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.surfaceLow : colors.surface })}>
          <Icon name={l.icon} size={20} color={colors.primaryDeep} />
          <AppText variant="labelMd" style={{ flex: 1 }} numberOfLines={2}>{t(l.label)}</AppText>
        </Pressable>
      ))}
    </View>
  );
}
