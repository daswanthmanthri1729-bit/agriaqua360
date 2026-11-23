// Calibration & maintenance — design: sensor_calibration_maintenance_diagnostics.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, Chip, EmptyState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { ago } from '@/components/Freshness';
import { calibrationDue, useAllChannels, useAlerts, useDevices } from '@/features/iot/api';
import { colors } from '@/theme';

export default function Calibration() {
  const { t } = useTranslation();
  const dq = useDevices(); const ch = useAllChannels(); const al = useAlerts('open');
  if (dq.isLoading || ch.isLoading) return <Screen><Header title={t('fleet.calTitle')} /><LoadingList /></Screen>;
  const real = (dq.data?.devices ?? []).filter((d) => !d.is_simulated);
  const sensors = (ch.data ?? []).filter((c) => c.kind === 'sensor' && c.sensor_type !== 'battery' && real.some((d) => d.id === c.device_id));
  if (!sensors.length) return <Screen><Header title={t('fleet.calTitle')} /><EmptyState icon="tune" title={t('fleet.noReal')} text={t('fleet.noRealText')} /></Screen>;
  const due = sensors.filter((c) => calibrationDue(c));
  const faulty = (al.data ?? []).filter((a) => a.kind === 'rejected');
  const lowBattery = real.filter((d) => d.battery_pct != null && d.battery_pct < 20);
  return (
    <Screen>
      <Header title={t('fleet.calTitle')} />
      <Card style={{ flexDirection: 'row', gap: 8 }}>
        {[[t('fleet.calDue'), due.length], [t('fleet.faulty'), faulty.length], [t('fleet.lowBattery'), lowBattery.length]].map(([l, v]) => (
          <View key={l as string} style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="labelSm" color={colors.textSubtle} align="center">{l as string}</AppText>
            <AppText variant="headlineMd" color={(v as number) ? colors.warning : colors.primary}>{String(v)}</AppText>
          </View>
        ))}
      </Card>
      {faulty.length > 0 && <Banner tone="error" message={t('fleet.faultyHelp')} />}
      <SectionHeader title={t('fleet.channels')} />
      {sensors.map((c) => {
        const d = real.find((x) => x.id === c.device_id)!;
        const bad = faulty.some((a) => a.device_id === c.device_id && a.sensor_type === c.sensor_type);
        return (
          <Card key={c.id} onPress={() => router.push(`/monitor/device/${c.device_id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={`${d.name} ${t(`sensors.${c.sensor_type}`)}`}>
            <View style={{ flex: 1 }}>
              <AppText variant="labelLg">{t(`sensors.${c.sensor_type}`)}</AppText>
              <AppText variant="bodySm" color={colors.textMuted}>{d.name} · {c.calibrated_at ? t('calibration.last', { when: ago(c.calibrated_at, t) }) : t('fleet.neverCalibrated')} · ×{c.calibration_scale} {Number(c.calibration_offset) >= 0 ? '+' : ''}{c.calibration_offset}</AppText>
            </View>
            {bad ? <Chip tone="error" label={t('fleet.faultyShort')} /> : calibrationDue(c) ? <Chip tone="warning" label={t('fleet.dueShort')} /> : <Chip label={t('fleet.okShort')} />}
          </Card>
        );
      })}
      <AppText variant="bodySm" color={colors.textMuted}>{t('fleet.calTips')}</AppText>
    </Screen>
  );
}
