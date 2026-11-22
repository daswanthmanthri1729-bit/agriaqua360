import { ReactNode, useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { colors, fonts, radius } from '@/theme';

type Props = TextInputProps & {
  label: string;
  required?: boolean;
  icon?: IconName;
  prefix?: ReactNode;
  error?: string;
  hint?: string;
  labelAside?: ReactNode;
  secureToggle?: boolean;
};

export function TextField({ label, required, icon, prefix, error, hint, labelAside, secureToggle, style, onFocus, onBlur, ...input }: Props) {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secureToggle);
  const borderColor = error ? colors.error : focused ? colors.secondary : colors.border;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <AppText variant="labelLg">
          {label}
          {required && <AppText variant="labelLg" color={colors.error}> *</AppText>}
        </AppText>
        {labelAside}
      </View>
      <View style={[styles.box, { borderColor, borderWidth: focused || error ? 2 : 1 }]}>
        {icon && <Icon name={icon} color={colors.textSubtle} />}
        {prefix}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.outline}
          secureTextEntry={hidden}
          style={[styles.input, style]}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...input}
        />
        {secureToggle && (
          <Pressable
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t('common.showPassword') : t('common.hidePassword')}
            onPress={() => setHidden((h) => !h)}
          >
            <Icon name={hidden ? 'visibility' : 'visibility-off'} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {error ? (
        <AppText variant="bodySm" color={colors.error} accessibilityLiveRegion="polite">{error}</AppText>
      ) : hint ? (
        <AppText variant="bodySm" color={colors.textSubtle}>{hint}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  box: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text, paddingVertical: 12 },
});
