import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { TextField } from './TextField';
import { formatDate, isoDate, parseDate } from '@/lib/dates';
import { colors, radius } from '@/theme';

type Props = { label: string; value: string; onChange: (v: string) => void; error?: string; required?: boolean; minimumDate?: string };

// Android: native calendar dialog. Elsewhere (web preview / iOS): typed YYYY-MM-DD.
export function DateField({ label, value, onChange, error, required, minimumDate }: Props) {
  const { t, i18n } = useTranslation();
  if (Platform.OS !== 'android') {
    return <TextField label={label} required={required} icon="event" placeholder="YYYY-MM-DD" value={value} onChangeText={onChange} error={error} />;
  }
  const open = () =>
    DateTimePickerAndroid.open({
      value: value ? parseDate(value) : new Date(),
      mode: 'date',
      minimumDate: minimumDate ? parseDate(minimumDate) : undefined,
      onChange: (e, d) => e.type === 'set' && d && onChange(isoDate(d)),
    });
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="labelLg">{label}{required && <AppText variant="labelLg" color={colors.error}> *</AppText>}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatDate(value, i18n.language) : t('common.selectDate')}`}
        onPress={open} style={[styles.box, error && { borderColor: colors.error, borderWidth: 2 }]}>
        <Icon name="event" color={colors.textSubtle} />
        <AppText variant="bodyLg" color={value ? colors.text : colors.outline} style={{ flex: 1 }}>
          {value ? formatDate(value, i18n.language) : t('common.selectDate')}
        </AppText>
        {value && !required && (
          <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.remove')} onPress={() => onChange('')}>
            <Icon name="close" color={colors.textSubtle} />
          </Pressable>
        )}
      </Pressable>
      {error && <AppText variant="bodySm" color={colors.error}>{error}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
});
