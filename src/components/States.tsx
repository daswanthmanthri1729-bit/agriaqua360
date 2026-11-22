import { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Button } from './Button';
import { Icon, IconName } from './Icon';
import { colors, radius } from '@/theme';

export function Skeleton({ height = 96, style }: { height?: number; style?: ViewStyle }) {
  const o = useSharedValue(0.5);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View accessibilityElementsHidden style={[{ height, borderRadius: radius.card, backgroundColor: colors.surfaceHigh }, a, style]} />;
}

export function LoadingList({ count = 3, height }: { count?: number; height?: number }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 12 }} accessible accessibilityLabel={t('common.loading')}>
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} height={height} />)}
    </View>
  );
}

export function EmptyState({ icon, title, text, action, onAction }: { icon: IconName; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.box}>
      <View style={styles.icon}><Icon name={icon} size={32} color={colors.primary} /></View>
      <AppText variant="headlineSm" align="center">{title}</AppText>
      {text && <AppText variant="bodyMd" color={colors.textMuted} align="center">{text}</AppText>}
      {action && onAction && <Button compact label={action} iconLeft="add" onPress={onAction} />}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.box} accessibilityRole="alert">
      <View style={[styles.icon, { backgroundColor: colors.errorSurface }]}><Icon name="cloud-off" size={32} color={colors.error} /></View>
      <AppText variant="bodyLg" align="center">{message ?? t('errors.loadFailed')}</AppText>
      {onRetry && <Button compact variant="secondary" iconLeft="refresh" label={t('common.retry')} onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 10, padding: 24, borderRadius: radius.card, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.outline, backgroundColor: colors.surfaceLow },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
});
