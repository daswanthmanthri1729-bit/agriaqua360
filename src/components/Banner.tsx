import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { colors, radius } from '@/theme';

type Tone = 'info' | 'error' | 'success' | 'ai' | 'warning';
const tones: Record<Tone, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: colors.surfaceContainer, fg: colors.ai, icon: 'info-outline' },
  error: { bg: colors.errorSurface, fg: colors.error, icon: 'error-outline' },
  success: { bg: colors.chip, fg: colors.primary, icon: 'check-circle-outline' },
  ai: { bg: colors.aiSurface, fg: colors.ai, icon: 'auto-awesome' },
  warning: { bg: colors.warningSurface, fg: colors.warning, icon: 'warning-amber' },
};

export function Banner({ tone = 'info', title, message, onDismiss }: { tone?: Tone; title?: string; message: string; onDismiss?: () => void }) {
  const { t } = useTranslation();
  const c = tones[tone];
  return (
    <View style={[styles.wrap, { backgroundColor: c.bg }]} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <Icon name={c.icon} color={c.fg} />
      <View style={{ flex: 1, gap: 2 }}>
        {title && <AppText variant="labelLg">{title}</AppText>}
        <AppText variant="bodyMd" color={colors.textMuted}>{message}</AppText>
      </View>
      {onDismiss && (
        <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.dismiss')} onPress={onDismiss}>
          <Icon name="close" color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: radius.lg, alignItems: 'flex-start' },
});
