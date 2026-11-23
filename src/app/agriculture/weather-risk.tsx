// Extreme weather & climate risk alerts — design: extreme_weather_climate_risk_alert_center.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, Header, Icon, LoadingList, Screen, SectionHeader } from '@/components';
import { weatherRisks } from '@/features/intel/crop';
import { useWeather, useWeatherTarget } from '@/features/weather/api';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

const ADV_ICON = { heavy_rain: 'thunderstorm', heat: 'wb-sunny', strong_wind: 'air', cold: 'ac-unit' } as const;

export default function WeatherRisk() {
  const { t, i18n } = useTranslation();
  const w = useWeather(useWeatherTarget());
  if (w.isLoading) return <Screen><Header title={t('wx.riskTitle')} /><LoadingList /></Screen>;
  const d = w.data;
  if (!d) return <Screen><Header title={t('wx.riskTitle')} /><Banner tone="warning" message={t('dashboard.setLocation')} /></Screen>;
  const risks = weatherRisks(d.hourly ?? []).filter((r) => r.level !== 'low');
  const hottest = [...d.daily].sort((a, b) => b.max - a.max)[0];
  const wettest = [...d.daily].sort((a, b) => b.rain_mm - a.rain_mm)[0];
  const windiest = [...d.daily].sort((a, b) => b.wind_kmh - a.wind_kmh)[0];
  return (
    <Screen>
      <Header title={t('wx.riskTitle')} />
      <AppText variant="labelLg">{d.location.name}</AppText>
      <SectionHeader title={t('weather.advisories')} />
      {d.advisories.length ? d.advisories.map((a, i) => (
        <Card key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.warningSurface }}>
          <Icon name={ADV_ICON[a.kind]} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <AppText variant="labelLg">{formatDate(a.date, i18n.language, { weekday: 'long', day: 'numeric', month: 'short' })}</AppText>
            <AppText variant="bodyMd">{t(`weather.adv.${a.kind}`, { value: a.value })}</AppText>
          </View>
        </Card>
      )) : <Banner tone="success" message={t('weather.noAdvisories')} />}
      <SectionHeader title={t('wx.extremes')} />
      <Card style={{ flexDirection: 'row', gap: 8 }}>
        {[[t('wx.hottest'), `${hottest.max}°C`, hottest.date], [t('wx.wettest'), `${wettest.rain_mm} mm`, wettest.date], [t('wx.windiest'), `${windiest.wind_kmh} km/h`, windiest.date]].map(([l, v, dt]) => (
          <View key={l} style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="labelSm" color={colors.textSubtle}>{l}</AppText>
            <AppText variant="headlineSm">{v}</AppText>
            <AppText variant="labelSm" color={colors.textMuted}>{formatDate(dt, i18n.language, { weekday: 'short' })}</AppText>
          </View>
        ))}
      </Card>
      <SectionHeader title={t('wx.cropRisks')} />
      {risks.length ? risks.map((r) => (
        <Card key={r.kind} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <AppText variant="bodyMd" style={{ flex: 1 }}>{t(`risk.${r.kind}`)}</AppText>
          <Chip tone={r.level === 'high' ? 'error' : 'warning'} label={t(`risk.level.${r.level}`)} />
        </Card>
      )) : <Banner tone="success" message={t('wx.noCropRisk')} />}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('weather.advisoryNote')}</AppText>
      <Button variant="secondary" iconLeft="notifications" label={t('settings.notifications')} onPress={() => router.push('/settings/notifications')} />
    </Screen>
  );
}
