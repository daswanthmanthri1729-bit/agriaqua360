// Climate & seasonal planning — design: ai_climate_intelligence_seasonal_planning. 90 days of NASA data + season guidance.
import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, Chip, Header, LineChart, LoadingList, Screen, SectionHeader, SourceBadge } from '@/components';
import { useClimateHistory } from '@/features/intel/api';
import { gdd, seasonOf } from '@/features/intel/crop';
import { useWeather, useWeatherTarget } from '@/features/weather/api';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

export default function Climate() {
  const { t, i18n } = useTranslation();
  const w = useWeather(useWeatherTarget());
  const h = useClimateHistory(w.data?.location.lat, w.data?.location.lon, 90);
  const temp = useMemo(() => (h.data?.days ?? []).filter((d) => d.temp_avg != null).map((d) => ({ x: Date.parse(d.date), y: d.temp_avg!, lo: d.temp_min ?? undefined, hi: d.temp_max ?? undefined })), [h.data]);
  const month = new Date().getMonth() + 1;
  const season = seasonOf(month), next = seasonOf(((month + 2) % 12) + 1);
  return (
    <Screen>
      <Header title={t('wx.climateTitle')} />
      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip icon="event" label={`${t('wx.nowSeason')}: ${t(`crops.seasons.${season}`)}`} />
          {next !== season && <Chip tone="ai" icon="update" label={`${t('wx.nextSeason')}: ${t(`crops.seasons.${next}`)}`} />}
        </View>
        <AppText variant="bodyMd">{t(`wx.seasonTip.${season}`)}</AppText>
      </Card>
      {w.isLoading || h.isLoading ? <LoadingList count={2} height={160} /> : !h.data ? <Banner tone="warning" message={t('weather.historyFailed')} /> : (
        <>
          <SectionHeader title={t('wx.last90')} />
          <Card style={{ gap: 8 }}>
            <LineChart series={[{ points: temp, color: colors.warning, label: t('weather.temp') }]} unit="°C" formatX={(x) => formatDate(new Date(x).toISOString().slice(0, 10), i18n.language, { day: 'numeric', month: 'short' })} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[[t('weather.rainTotal'), `${h.data.summary.rain_total_mm ?? '—'} mm`], [t('weather.lastYear'), h.data.last_year_summary ? `${h.data.last_year_summary.rain_total_mm} mm` : '—'], [t('weather.avgTemp'), `${h.data.summary.temp_avg ?? '—'}°C`], ['GDD', String(gdd(h.data.days))]].map(([l, v]) => (
                <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                  <AppText variant="labelSm" color={colors.textSubtle} align="center">{l}</AppText>
                  <AppText variant="labelLg">{v}</AppText>
                </View>
              ))}
            </View>
            {h.data.last_year_summary?.temp_avg != null && h.data.summary.temp_avg != null && (
              <AppText variant="bodyMd">{t('wx.tempVsLastYear', { diff: Math.round((h.data.summary.temp_avg - h.data.last_year_summary.temp_avg) * 10) / 10 })}</AppText>
            )}
            <AppText variant="labelSm" color={colors.textSubtle}>{t('wx.gddNote')}</AppText>
            <SourceBadge source="api" label="NASA POWER" />
          </Card>
        </>
      )}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('wx.climateNote')}</AppText>
    </Screen>
  );
}
