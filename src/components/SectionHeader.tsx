import { Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { colors } from '@/theme';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <AppText variant="headlineSm" accessibilityRole="header" style={{ flex: 1 }}>{title}</AppText>
      {action && onAction && (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction} style={{ minHeight: 44, justifyContent: 'center' }}>
          <AppText variant="labelLg" color={colors.primary}>{action}</AppText>
        </Pressable>
      )}
    </View>
  );
}
