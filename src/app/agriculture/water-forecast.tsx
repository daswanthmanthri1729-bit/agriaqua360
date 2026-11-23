// 7-day crop water forecast — design: ai_water_management_irrigation_predictions.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, BarChart, Button, Card, EmptyState, Header, LoadingList, Screen, SourceBadge } from '@/components';
import { kc } from '@/features/intel/agronomy';
import { useCropContext } from '@/features/intel/useCropContext';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

export default function WaterForecast() {
  const { t, i18n } = useTranslation();
  const { loading, crop, weather, picker } = useCropContext();
  if (loading) return <Screen><Header title={t('wx.waterTitle')} /><LoadingList /></Screen>;
  if (!crop) return <Screen><Header title={t('wx.waterTitle')} /><EmptyState icon="eco" title={t('irrigation.noCrop')} action={t('dashboard.addCrop')} onAction={() => router.push('/agriculture/crops/new')} /></Screen>;
  const k = kc(crop.name, crop.growth_stage);
  const days = (weather.data?.daily ?? []).filter((d) => d.et0_mm != null);
  const rows = days.map((d) => { const need = Math.max(0, k * d.et0_mm! - (d.rain_mm >= 5 ? 0.8 * d.rain_mm : 0)); return { ...d, need: Math.round(need * 10) / 10, litres: crop.area_acres ? Math.round(need * crop.area_acres * 4046.86) : null }; });
  const week = rows.reduce((s, r) => s + r.need, 0);
  return (
    <Screen>
      <Header title={t('wx.waterTitle')} />
      {picker}
      {weather.isLoading ? <LoadingList count={1} height={180} /> : !rows.length ? <Banner tone="warning" message={t('irrigation.noEt0')} /> : (
        <>
          <Card style={{ gap: 8 }}>
            <AppText variant="labelLg">{t('wx.weekNeed', { mm: Math.round(week), crop: crop.name })}</AppText>
            <BarChart bars={rows.map((r) => ({ label: formatDate(r.date, i18n.language, { weekday: 'short' }), value: r.need, color: r.need > 5 ? colors.warning : colors.primary }))} unit="mm" formatY={(y) => `${Math.round(y)}`} />
            <AppText variant="labelSm" color={colors.textSubtle}>{t('irrigation.method', { kc: k, etc: Math.round(week), days: rows.length })}</AppText>
          </Card>
          <Card style={{ gap: 6 }}>
            {rows.map((r) => (
              <View key={r.date} style={{ flexDirection: 'row', gap: 8 }}>
                <AppText variant="labelLg" style={{ width: 90 }}>{formatDate(r.date, i18n.language, { weekday: 'short', day: 'numeric' })}</AppText>
                <AppText variant="bodyMd" style={{ flex: 1 }}>{r.need} mm{r.litres != null ? ` · ${r.litres.toLocaleString('en-IN')} L` : ''}</AppText>
                <AppText variant="labelSm" color={colors.water}>{r.rain_mm ? `☔ ${r.rain_mm} mm` : ''}</AppText>
              </View>
            ))}
          </Card>
          <SourceBadge source="ai_estimate" label={t('wx.estimateFao')} />
          <Button variant="secondary" iconLeft="water-drop" label={t('irrigation.title')} onPress={() => router.push({ pathname: '/agriculture/irrigation', params: { crop: crop.id } })} />
        </>
      )}
    </Screen>
  );
}
