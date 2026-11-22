import { Image } from 'expo-image';

// Small brand emblem shown on every screen header. Decorative: hidden from screen readers to avoid repetition.
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <Image source={require('../../assets/images/logo-mark.png')} style={{ width: size, height: size * 0.85 }} contentFit="contain"
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
  );
}
