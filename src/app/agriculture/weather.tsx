// 17 · Weather Information — Stitch: 11_current_weather_screen + 12_weather_forecast_screen (HTML only)
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Button, Card, ErrorState, Freshness, Header, Icon, IconName, LineChart, LoadingList, Screen, SectionHeader, SourceBadge, TextField } from '@/components';
import { pondImpact, sprayWindow } from '@/features/intel/agronomy';
import { useClimateHistory } from '@/features/intel/api';
import { formatStamp } from '@/lib/dates';
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
      setPlace({ lat: p.latitude, lon: p.longitude, name: p.village });
    } catch (e) {
      setLocError(e instanceof LocationDeniedError ? 'profileSetup.locationDenied' : 'profileSetup.locationFailed');
    } finally { setLocating(false); }
  };
  const search = () => city.trim() && setPlace({ city: `${city.trim()},IN` });

  const d = w.data;
  const history = useClimateHistory(d?.location.lat, d?.location.lon, 30);
  const spray = useMemo(() => (d?.hourly ? sprayWindow(d.hourly) : null), [d]);
  const pond = d ? pondImpact(d.daily) : null;
  const hourPts = useMemo(() => (d?.hourly ?? []).map((h) => ({ x: Date.parse(h.time), y: h.temp })), [d]);
  const popPts = useMemo(() => (d?.hourly ?? []).map((h) => ({ x: Date.parse(h.time), y: h.pop })), [d]);
  const h = history.data;
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

      {!target ? <Banner message={t('dashboard.setLocation')} /> : w.isLoading ? <LoadingList count={3} height={120} /> : !d ? (
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

          <Freshness at={d.fetched_at ?? d.observed_at} staleAfterMin={60} source={d.source === 'openweather' ? 'OpenWeather' : 'Open-Meteo'} />

          {hourPts.length > 0 && (
            <>
              <SectionHeader title={t('weather.next48')} />
              <Card style={{ gap: 8 }}>
                <LineChart series={[{ points: hourPts, label: t('weather.temp'), color: colors.warning }]} unit="°C" height={150} formatX={(x) => formatStamp(x, i18n.language, { weekday: 'short', hour: 'numeric' })} formatY={(y) => `${Math.round(y)}`} />
                <LineChart series={[{ points: popPts, label: t('dashboard.rainChance'), color: colors.water }]} unit="%" height={110} yMin={0} yMax={100} formatX={(x) => formatStamp(x, i18n.language, { weekday: 'short', hour: 'numeric' })} formatY={(y) => `${Math.round(y)}`} />
              </Card>
            </>
          )}

          <SectionHeader title={t('weather.farmAdvice')} />
          <Card style={{ gap: 10 }}>
            <View style={styles.row}>
              <Icon name="sanitizer" color={spray ? colors.primary : colors.warning} />
              <AppText variant="bodyMd" style={{ flex: 1 }}>{spray ? t('weather.sprayWindow', { from: formatStamp(spray.from, i18n.language, { weekday: 'short', hour: 'numeric' }), to: formatStamp(spray.to, i18n.language, { hour: 'numeric' }) }) : t('weather.noSprayWindow')}</AppText>
            </View>
            {d.daily[0]?.et0_mm != null && (
              <View style={styles.row}>
                <Icon name="water-drop" color={colors.water} />
                <AppText variant="bodyMd" style={{ flex: 1 }}>{t('weather.et0Today', { value: d.daily[0].et0_mm })}</AppText>
              </View>
            )}
            {pond && (
              <View style={styles.row}>
                <Icon name="set-meal" color={colors.warning} />
                <AppText variant="bodyMd" style={{ flex: 1 }}>{t(`weather.pond.${pond.kind}`, { date: formatDate(pond.date, i18n.language, { weekday: 'long' }) })}</AppText>
              </View>
            )}
            {d.soil_moisture_estimate && (
              <View style={styles.row}>
                <Icon name="grass" color={colors.primary} />
                <AppText variant="bodyMd" style={{ flex: 1 }}>{t('weather.soilModel', { value: d.soil_moisture_estimate.cm_3_9_pct ?? d.soil_moisture_estimate.top_1cm_pct })}</AppText>
              </View>
            )}
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
                  <AppText variant="labelSm" color={colors.water}>{day.pop}%{day.rain_mm ? ` · ${t('weather.rainMm', { value: day.rain_mm })}` : ''}{day.et0_mm != null ? ` · ET0 ${day.et0_mm} mm` : ''}</AppText>
                </View>
                <AppText variant="labelLg">{day.min}° / {day.max}°</AppText>
              </View>
            ))}
          </Card>

          <SectionHeader title={t('weather.past30')} />
          {history.isLoading ? <LoadingList count={1} height={150} /> : !h ? <Banner tone="warning" message={t('weather.historyFailed')} /> : (
            <Card style={{ gap: 10 }}>
              <BarChart bars={h.days.map((x) => ({ label: formatDate(x.date, i18n.language, { day: 'numeric' }), value: x.rain_mm ?? 0, color: colors.water }))} unit="mm" height={130} formatY={(y) => `${Math.round(y)}`} />
              <View style={styles.row}>
                {[[t('weather.rainTotal'), `${h.summary.rain_total_mm ?? '—'} mm`], [t('weather.lastYear'), h.last_year_summary ? `${h.last_year_summary.rain_total_mm ?? '—'} mm` : '—'], [t('weather.rainyDays'), String(h.summary.rainy_days)], [t('weather.avgTemp'), h.summary.temp_avg != null ? `${h.summary.temp_avg}°C` : '—']].map(([l, v]) => (
                  <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                    <AppText variant="labelSm" color={colors.textSubtle} align="center">{l}</AppText>
                    <AppText variant="labelLg">{v}</AppText>
                  </View>
                ))}
              </View>
              {h.last_year_summary?.rain_total_mm != null && h.summary.rain_total_mm != null && (
                <AppText variant="bodyMd">{t(h.summary.rain_total_mm >= h.last_year_summary.rain_total_mm ? 'weather.wetterThanLastYear' : 'weather.drierThanLastYear', { diff: Math.abs(Math.round(h.summary.rain_total_mm - h.last_year_summary.rain_total_mm)) })}</AppText>
              )}
              <SourceBadge source="api" label="NASA POWER" />
              <AppText variant="labelSm" color={colors.textSubtle}>{t('weather.nasaNote', { date: h.data_until ? formatDate(h.data_until, i18n.language) : '—' })}</AppText>
            </Card>
          )}
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
