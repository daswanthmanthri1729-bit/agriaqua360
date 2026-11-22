// Tokens from design_reference/.../intelligent_nature/DESIGN.md ("Intelligent Nature").
export const colors = {
  primary: '#176B45',
  primaryDark: '#0E4B2F',
  primaryDeep: '#005131',
  secondary: '#20A66A',
  lime: '#B7E36A',
  mint: '#88D7A8',
  ai: '#6546C7',
  aiSurface: '#F2EFFC',
  background: '#F2FBF5',
  surface: '#FFFFFF',
  surfaceLow: '#E7F7EE',
  surfaceContainer: '#E2F2E8',
  surfaceHigh: '#DCECE2',
  chip: '#EBF7F0',
  text: '#17251D',
  textMuted: '#3F4942',
  textSubtle: '#718078',
  border: '#E3EBE5',
  outline: '#BFC9C0',
  error: '#BA1A1A',
  errorSurface: '#FFDAD6',
  warning: '#8A5A00',
  warningSurface: '#FFF1D6',
  water: '#2196F3',
  white: '#FFFFFF',
  splashTop: '#0E5A38',
  splashBottom: '#04311E',
} as const;

export const fonts = {
  headingXBold: 'Manrope_800ExtraBold',
  headingBold: 'Manrope_700Bold',
  headingSemi: 'Manrope_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const type = {
  display: { fontFamily: fonts.headingXBold, fontSize: 30, lineHeight: 38, letterSpacing: -0.4 },
  headlineLg: { fontFamily: fonts.headingBold, fontSize: 26, lineHeight: 34 },
  headlineMd: { fontFamily: fonts.headingBold, fontSize: 22, lineHeight: 28 },
  headlineSm: { fontFamily: fonts.headingSemi, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: fonts.bodyMedium, fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  labelLg: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 20 },
  labelMd: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
  labelSm: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 14, letterSpacing: 0.3 },
} as const;
export type TypeVariant = keyof typeof type;

export const radius = { sm: 4, md: 12, lg: 16, card: 18, xl: 24, full: 999 } as const;
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const shadow = {
  card: { shadowColor: '#176B45', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  raised: { shadowColor: '#17251D', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
} as const;
