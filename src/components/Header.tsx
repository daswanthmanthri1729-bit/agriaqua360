import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';
import { AppText } from './AppText';
import { colors, radius } from '@/theme';

export function Header({ title, right, onBack, hideBack }: { title?: string; right?: ReactNode; onBack?: () => void; hideBack?: boolean }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      {!hideBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
          style={({ pressed }) => [styles.back, pressed && { backgroundColor: colors.surfaceHigh }]}
        >
          <Icon name="arrow-back" />
        </Pressable>
      )}
      {title ? <AppText variant="headlineSm" style={{ flex: 1 }} numberOfLines={1}>{title}</AppText> : <View style={{ flex: 1 }} />}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  back: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
});
