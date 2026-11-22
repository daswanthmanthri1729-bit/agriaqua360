import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText } from './AppText';
import { Card } from './Card';
import { Icon, IconName } from './Icon';
import { Skeleton } from './States';
import { conditionIcon, conditionKey, useWeather, useWeatherTarget } from '@/features/weather/api';
import { colors, fonts, radius } from '@/theme';

export function WeatherCard() {
  const { t } = useTranslation();
  const target = useWeatherTarget();
  const { data, isLoading, error } = useWeather(target);
  if (isLoading) return <Skeleton height={180} />;
  if (!target || !data) { // keep showing the last forecast if a refresh fails
    return (
      <Card onPress={() => router.push('/agriculture/weather')} style={styles.row} accessibilityLabel={t('dashboard.weather')}>
        <Icon name={target ? 'cloud-off' : 'location-searching'} color={colors.textMuted} />
        <AppText variant="bodyMd" color={colors.textMuted} style={{ flex: 1 }}>
          {target ? t((error as Error | null)?.message ?? 'errors.weather_unavailable') : t('dashboard.setLocation')}
        </AppText>
        <Icon name="chevron-right" color={colors.textMuted} />
      </Card>
    );
  }
  const c = data.current;
  const stat = (icon: IconName, label: string, value: string) => (
    <View style={styles.stat}>
      <View style={styles.inline}><Icon name={icon} size={16} color={colors.textMuted} /><AppText variant="labelSm" color={colors.textMuted}>{label}</AppText></View>
      <AppText variant="headlineSm">{value}</AppText>
    </View>
  );
  return (
    <Card onPress={() => router.push('/agriculture/weather')} accessibilityLabel={`${t('dashboard.weather')} ${c.temp}°C ${t(conditionKey(c.condition))}`} style={{ gap: 12, backgroundColor: '#E7F9EE' }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <View style={styles.inline}><Icon name="place" size={16} color={colors.textMuted} /><AppText variant="labelMd" color={colors.textMuted} numberOfLines={1}>{data.location.name}</AppText></View>
          <View style={[styles.inline, { alignItems: 'flex-end' }]}>
            <AppText style={styles.temp}>{c.temp}°C</AppText>
            <AppText variant="bodyMd" color={colors.textMuted} style={{ marginBottom: 8 }}>{t('dashboard.feelsLike', { temp: c.feels_like })}</AppText>
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: 4 }}>
          <View style={styles.sun}><Icon name={conditionIcon(c.condition) as IconName} size={30} color={colors.primary} /></View>
          <AppText variant="labelMd" color={colors.textMuted}>{t(conditionKey(c.condition))}</AppText>
        </View>
      </View>
      <View style={styles.row}>
        {stat('water-drop', t('dashboard.humidity'), `${c.humidity}%`)}
        {stat('air', t('dashboard.wind'), `${c.wind_kmh} km/h`)}
        {stat('umbrella', t('dashboard.rainChance'), `${c.pop_today}%`)}
      </View>
      <View style={[styles.inline, { justifyContent: 'flex-end' }]}>
        <AppText variant="labelLg" color={colors.primary}>{t('dashboard.viewForecast')}</AppText>
        <Icon name="arrow-forward" size={18} color={colors.primary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  temp: { fontFamily: fonts.headingXBold, fontSize: 40, lineHeight: 48, color: colors.text },
  sun: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stat: { flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: colors.surface, gap: 2 },
});
