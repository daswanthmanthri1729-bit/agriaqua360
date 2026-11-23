import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Sheet, TextField } from '@/components';
import { colors } from '@/theme';
import type { Threshold } from '@/types/database';
import { SENSOR_UNITS, useSetThreshold } from './api';

const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export function ThresholdSheet({ deviceId, sensorType, existing, onClose }: { deviceId: string; sensorType: string | null; existing?: Threshold; onClose: () => void }) {
  const { t } = useTranslation();
  const set = useSetThreshold();
  const [min, setMin] = useState(''); const [max, setMax] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setMin(existing?.min_value != null ? String(existing.min_value) : ''); setMax(existing?.max_value != null ? String(existing.max_value) : ''); setError(null); }, [sensorType, existing]);
  const save = async () => {
    const lo = num(min), hi = num(max);
    if ((lo != null && Number.isNaN(lo)) || (hi != null && Number.isNaN(hi)) || (lo != null && hi != null && lo >= hi)) { setError('thresholds.invalid'); return; }
    try { await set.mutateAsync({ deviceId, sensorType: sensorType!, min: lo, max: hi, existing }); onClose(); } catch { setError('errors.generic'); }
  };
  return (
    <Sheet visible={!!sensorType} onClose={onClose}>
      <AppText variant="headlineMd">{t('thresholds.title', { param: sensorType ? t(`sensors.${sensorType}`) : '' })}</AppText>
      <AppText variant="bodySm" color={colors.textMuted}>{t('thresholds.help')}</AppText>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><TextField label={`${t('thresholds.min')} (${sensorType ? SENSOR_UNITS[sensorType] : ''})`} keyboardType="decimal-pad" value={min} onChangeText={setMin} /></View>
        <View style={{ flex: 1 }}><TextField label={`${t('thresholds.max')} (${sensorType ? SENSOR_UNITS[sensorType] : ''})`} keyboardType="decimal-pad" value={max} onChangeText={setMax} /></View>
      </View>
      {error && <Banner tone="error" message={t(error)} />}
      <Button label={t('common.save')} iconLeft="check" loading={set.isPending} onPress={save} />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}
