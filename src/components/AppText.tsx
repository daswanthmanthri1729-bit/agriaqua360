import { Text, TextProps, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, type, TypeVariant } from '@/theme';

type Props = TextProps & { variant?: TypeVariant; color?: string; align?: TextStyle['textAlign'] };

// DESIGN.md: Telugu/Hindi need ~18% taller lines so conjuncts and matras don't clip.
export function AppText({ variant = 'bodyMd', color = colors.text, align, style, ...rest }: Props) {
  const { i18n } = useTranslation();
  const base = type[variant];
  const indic = i18n.language !== 'en';
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      style={[base, { color, textAlign: align }, indic && { lineHeight: Math.round(base.lineHeight * 1.18) }, style]}
      {...rest}
    />
  );
}
