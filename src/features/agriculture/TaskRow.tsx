import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Icon, IconName } from '@/components';
import { formatDate } from '@/lib/dates';
import { colors, radius } from '@/theme';
import { ACTIVITY_ICON, RecordWithCrop, useToggleRecord } from './api';

export function TaskRow({ r, showCrop, showDate }: { r: RecordWithCrop; showCrop?: boolean; showDate?: boolean }) {
  const { t, i18n } = useTranslation();
  const toggle = useToggleRecord();
  const done = !!r.completed_at;
  const label = t(`calendar.activities.${r.activity}`);
  return (
    <View style={styles.row}>
      <View style={styles.icon}><Icon name={ACTIVITY_ICON[r.activity] as IconName} size={20} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <AppText variant="labelLg" style={done && { textDecorationLine: 'line-through', color: colors.textSubtle }}>
          {label}{showCrop && r.crop ? ` · ${r.crop.name}` : ''}
        </AppText>
        {(showDate || r.notes) && (
          <AppText variant="bodySm" color={colors.textMuted} numberOfLines={2}>
            {[showDate && r.scheduled_for && formatDate(r.scheduled_for, i18n.language), r.notes].filter(Boolean).join(' • ')}
          </AppText>
        )}
      </View>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done, busy: toggle.isPending }} accessibilityLabel={`${t('calendar.markDone')}: ${label}`}
        hitSlop={8} disabled={toggle.isPending} onPress={() => toggle.mutate({ id: r.id, done: !done })} style={[styles.check, done && styles.checked]}>
        {done && <Icon name="check" size={18} color={colors.white} />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  icon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  check: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
});
