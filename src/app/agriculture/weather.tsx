// 17 · Weather Information — Stitch: 11_current_weather_screen + 12_weather_forecast_screen (HTML only)
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, ErrorState, Header, Icon, IconName, LoadingList, Screen, SectionHeader, TextField } from '@/components';
import { conditionIcon, conditionKey, useWeather, useWeatherTarget } from '@/features/weather/api';
import { currentPlace, LocationDeniedError } from '@/services/location';
import { usePreferences } from '@/store/preferences';
import { formatDate, today } from '@/lib/dates';
import { colors, fonts, radius } from '@/theme';

export default function WeatherScreen() {
  const { t, i18n } = useTranslation();
  const target = useWeatherTarget();
  const setPlace = usePreferences((s) => s.setWeatherPlace);
  const w = useWeather(target);
  const [city, setCity] = useState('');
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const useGps = async () => {
    setLocating(true); setLocError(null);
    try {
      const p = await currentPlace();
      setPlace({ lat: p.latitude, lon: p.longitude });
    } catch (e) {
      setLocError(e instanceof LocationDeniedError ? 'profileSetup.locationDenied' : 'profileSetup.locationFailed');
    } finally { setLocating(false); }
  };
  const search = () => city.trim() && setPlace({ city: `${city.trim()},IN` });

  const d = w.data;
  return (
    <Screen>
      <Header title={t('weather.title')} />
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <TextField label={t('weather.search')} icon="search" value={city} onChangeText={setCity} returnKeyType="search" onSubmitEditing={search} />
        </View>
        <Button compact label={t('weather.searchButton')} onPress={search} style={{ marginTop: 26 }} />
      </View>
      <Button variant="tonal" iconLeft="my-location" label={t('weather.useCurrent')} loading={locating} onPress={useGps} />
      {locError && <Banner tone="warning" message={t(locError)} onDismiss={() => setLocError(null)} />}

      {!target ? <Banner message={t('dashboard.setLocation')} /> : w.isLoading ? <LoadingList count={3} height={120} /> : w.error || !d ? (
        <ErrorState message={`${t('weather.errorTitle')}. ${t((w.error as Error | null)?.message ?? 'errors.weather_unavailable')}`} onRetry={() => w.refetch()} />
      ) : (
        <>
          <Card style={{ gap: 12, backgroundColor: '#E7F9EE' }}>
            <View style={styles.row}>
              <Icon name="place" size={18} color={colors.textMuted} />
              <AppText variant="labelLg" style={{ flex: 1 }}>{d.location.name}</AppText>
              <AppText variant="labelSm" color={colors.textSubtle}>
                {t('common.updated', { time: new Date(d.observed_at).toLocaleTimeString(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`, { hour: '2-digit', minute: '2-digit' }) })}
              </AppText>
            </View>
            <View style={styles.row}>
              <Icon name={conditionIcon(d.current.condition) as IconName} size={56} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <AppText style={styles.temp}>{d.current.temp}°C</AppText>
                <AppText variant="bodyLg" color={colors.textMuted}>{t(conditionKey(d.current.condition))} · {t('dashboard.feelsLike', { temp: d.current.feels_like })}</AppText>
              </View>
            </View>
            <View style={styles.row}>
              {([['water-drop', t('dashboard.humidity'), `${d.current.humidity}%`], ['air', t('dashboard.wind'), `${d.current.wind_kmh} km/h`], ['umbrella', t('dashboard.rainChance'), `${d.current.pop_today}%`]] as const).map(([i, l, v]) => (
                <View key={l} style={styles.stat}>
                  <Icon name={i} size={18} color={colors.primary} />
                  <AppText variant="labelSm" color={colors.textMuted}>{l}</AppText>
                  <AppText variant="headlineSm">{v}</AppText>
                </View>
              ))}
            </View>
            {d.current.rain_1h_mm > 0 && <AppText variant="bodyMd">{t('weather.rainMm', { value: d.current.rain_1h_mm })}</AppText>}
          </Card>

          <SectionHeader title={t('weather.advisories')} />
          {d.advisories.length ? d.advisories.map((a, i) => (
            <Banner key={i} tone="warning" title={formatDate(a.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'short' })} message={t(`weather.adv.${a.kind}`, { value: a.value })} />
          )) : <Banner tone="success" message={t('weather.noAdvisories')} />}
          <AppText variant="bodySm" color={colors.textSubtle}>{t('weather.advisoryNote')}</AppText>

          <SectionHeader title={t('weather.forecast')} />
          <Card style={{ paddingVertical: 4 }}>
            {d.daily.map((day) => (
              <View key={day.date} style={styles.dayRow} accessible accessibilityLabel={`${day.date} ${t(conditionKey(day.condition))} ${day.min}-${day.max}°C`}>
                <AppText variant="labelLg" style={{ width: 84 }}>{day.date === today() ? t('weather.today') : formatDate(day.date, i18n.language, { weekday: 'short', day: 'numeric' })}</AppText>
                <Icon name={conditionIcon(day.condition) as IconName} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>{t(conditionKey(day.condition))}</AppText>
                  <AppText variant="labelSm" color={colors.water}>{day.pop}%{day.rain_mm ? ` · ${t('weather.rainMm', { value: day.rain_mm })}` : ''}</AppText>
                </View>
                <AppText variant="labelLg">{day.min}° / {day.max}°</AppText>
              </View>
            ))}
          </Card>
          <AppText variant="bodySm" color={colors.textSubtle} align="center">{t('weather.source')}</AppText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  temp: { fontFamily: fonts.headingXBold, fontSize: 44, lineHeight: 52, color: colors.text },
  stat: { flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: colors.surface, gap: 2 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, borderBottomWidth: 1, borderBottomColor: colors.border },
});
