import { View } from 'react-native';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';
import { colors, radius } from '@/theme';

// Small labelled metric tile (design "Extents / Crop Sown" blocks).
export function InfoTile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={{ flex: 1, minWidth: 140, flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: radius.lg, backgroundColor: colors.surfaceLow }}>
      <Icon name={icon} size={22} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <AppText variant="labelSm" color={colors.textSubtle}>{label}</AppText>
        <AppText variant="labelLg" numberOfLines={2}>{value}</AppText>
      </View>
    </View>
  );
}
