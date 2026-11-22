import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { colors, radius } from '@/theme';

type Variant = 'primary' | 'secondary' | 'tonal' | 'ai' | 'text' | 'danger';
type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: IconName;
  iconLeft?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  compact?: boolean;
  testID?: string;
};

const palette: Record<Variant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: colors.primaryDeep, pressed: colors.primaryDark, fg: colors.white },
  secondary: { bg: 'transparent', pressed: colors.surfaceLow, fg: colors.primary, border: colors.secondary },
  tonal: { bg: colors.surfaceContainer, pressed: colors.surfaceHigh, fg: colors.primaryDeep },
  ai: { bg: colors.ai, pressed: '#4C28AD', fg: colors.white },
  text: { bg: 'transparent', pressed: colors.surfaceLow, fg: colors.primary },
  danger: { bg: colors.error, pressed: '#93000A', fg: colors.white },
};

export function Button({ label, onPress, variant = 'primary', icon, iconLeft, loading, disabled, style, compact, testID }: Props) {
  const p = palette[variant];
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: pressed ? p.pressed : p.bg, opacity: off && !loading ? 0.5 : 1 },
        p.border && { borderWidth: 1.5, borderColor: p.border },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {iconLeft && <Icon name={iconLeft} color={p.fg} size={20} />}
          <AppText variant={compact ? 'labelLg' : 'bodyLg'} color={p.fg} style={styles.label} numberOfLines={1}>
            {label}
          </AppText>
          {icon && <Icon name={icon} color={p.fg} size={20} />}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 52, borderRadius: radius.lg, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  compact: { minHeight: 44, borderRadius: radius.md, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: 'Inter_700Bold' },
});
