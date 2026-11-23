// Rainfall & water balance — design: advanced_rainfall_irrigation_weather_analytics.
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Card, Header, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { useClimateHistory } from '@/features/intel/api';
import { useWeather, useWeatherTarget } from '@/features/weather/api';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

export default function Rainfall() {
  const { t, i18n } = useTranslation();
  const w = useWeather(useWeatherTarget());
  const h = useClimateHistory(w.data?.location.lat, w.data?.location.lon, 90);
  const weeks = new Map<string, number>();
  (h.data?.days ?? []).forEach((d) => { const wk = new Date(Date.parse(d.date) - new Date(d.date).getUTCDay() * 86_400_000).toISOString().slice(0, 10); weeks.set(wk, (weeks.get(wk) ?? 0) + (d.rain_mm ?? 0)); });
  const daily = w.data?.daily ?? [];
  const balance = daily.reduce((s, d) => s + d.rain_mm - (d.et0_mm ?? 0), 0);
  return (
    <Screen>
      <Header title={t('wx.rainTitle')} />
      {w.isLoading || h.isLoading ? <LoadingList count={2} height={150} /> : (
        <>
          <SectionHeader title={t('wx.weeklyRain')} />
          {h.data ? (
            <Card style={{ gap: 8 }}>
              <BarChart bars={[...weeks.entries()].map(([d, v]) => ({ label: formatDate(d, i18n.language, { day: 'numeric', month: 'short' }), value: Math.round(v), color: colors.water }))} unit="mm" />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[[t('wx.days90'), `${h.data.summary.rain_total_mm ?? '—'} mm`], [t('weather.lastYear'), h.data.last_year_summary ? `${h.data.last_year_summary.rain_total_mm} mm` : '—'], [t('weather.rainyDays'), String(h.data.summary.rainy_days)]].map(([l, v]) => (
                  <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                    <AppText variant="labelSm" color={colors.textSubtle} align="center">{l}</AppText>
                    <AppText variant="labelLg">{v}</AppText>
                  </View>
                ))}
              </View>
              <SourceBadge source="api" label="NASA POWER" />
            </Card>
          ) : <Banner tone="warning" message={t('weather.historyFailed')} />}
          <SectionHeader title={t('wx.balanceTitle')} />
          {daily.length ? (
            <Card style={{ gap: 8 }}>
              <BarChart bars={daily.flatMap((d) => [{ label: formatDate(d.date, i18n.language, { weekday: 'short' }), value: d.rain_mm, color: colors.water }, { label: '', value: d.et0_mm ?? 0, color: colors.warning }])} unit="mm" height={140} formatY={(y) => `${Math.round(y)}`} />
              <AppText variant="labelSm" color={colors.textSubtle}>{t('wx.balanceLegend')}</AppText>
              <AppText variant="bodyMd" color={balance < 0 ? colors.warning : colors.primary}>{t(balance < 0 ? 'wx.deficit' : 'wx.surplus', { mm: Math.abs(Math.round(balance)) })}</AppText>
              <SourceBadge source="api" label="Open-Meteo" />
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
