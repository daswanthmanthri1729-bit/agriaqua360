import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { colors, radius } from '@/theme';

type Tone = 'normal' | 'ai' | 'warning' | 'error' | 'dark';
const tones: Record<Tone, { bg: string; fg: string }> = {
  normal: { bg: colors.chip, fg: colors.primary },
  ai: { bg: colors.aiSurface, fg: colors.ai },
  warning: { bg: colors.warningSurface, fg: colors.warning },
  error: { bg: colors.errorSurface, fg: colors.error },
  dark: { bg: 'rgba(255,255,255,0.12)', fg: colors.white },
};

export function Chip({ label, tone = 'normal', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      {icon && <Icon name={icon} size={16} color={c.fg} />}
      <AppText variant="labelMd" color={c.fg} numberOfLines={1}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28, paddingHorizontal: 12, borderRadius: radius.full, alignSelf: 'flex-start' },
});
