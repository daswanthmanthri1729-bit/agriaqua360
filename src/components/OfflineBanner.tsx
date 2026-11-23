import { View } from 'react-native';
import { useNetworkState } from 'expo-network';
import { useMutationState } from '@tanstack/react-query';
import { OFFLINE_INSERT } from '@/lib/query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors } from '@/theme';

export function OfflineBanner() {
  const { t } = useTranslation();
  const net = useNetworkState();
  const insets = useSafeAreaInsets();
  const queued = useMutationState({ filters: { mutationKey: OFFLINE_INSERT, status: 'pending' } }).length;
  if (net.isConnected !== false && net.isInternetReachable !== false) return null;
  return (
    <View accessibilityRole="alert" style={{ paddingTop: insets.top + 6, paddingBottom: 8, paddingHorizontal: 16, backgroundColor: colors.warningSurface, flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Icon name="cloud-off" size={18} color={colors.warning} />
      <AppText variant="labelMd" color={colors.warning} style={{ flex: 1 }}>{t('common.offline')}{queued ? ` · ${t('common.queued', { count: queued })}` : ''}</AppText>
    </View>
  );
}
