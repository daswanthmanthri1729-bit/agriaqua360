import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { onlineManager } from '@tanstack/react-query';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors } from '@/theme';

/** "Updated 5 min ago" — turns amber when older than staleAfterMin or when showing cached data offline. */
export function ago(iso: string | null | undefined, t: TFunction) {
  if (!iso) return t('time.never');
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return t('time.justNow');
  if (min < 60) return t('time.minAgo', { count: min });
  if (min < 48 * 60) return t('time.hrAgo', { count: Math.round(min / 60) });
  return t('time.dayAgo', { count: Math.round(min / 1440) });
}
export function Freshness({ at, staleAfterMin = 60, source }: { at: string | null | undefined; staleAfterMin?: number; source?: string }) {
  const { t } = useTranslation();
  const stale = !at || Date.now() - Date.parse(at) > staleAfterMin * 60_000 || !onlineManager.isOnline();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} accessibilityRole="text">
      <Icon name={stale ? 'history' : 'update'} size={14} color={stale ? colors.warning : colors.textSubtle} />
      <AppText variant="labelSm" color={stale ? colors.warning : colors.textSubtle}>
        {t('time.updated', { when: ago(at, t) })}{stale && at ? ` · ${t('time.stale')}` : ''}{source ? ` · ${source}` : ''}
      </AppText>
    </View>
  );
}
