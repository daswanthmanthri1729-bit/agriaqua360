// Activity anomaly detection — design: ai_livestock_activity_anomaly_detection. Each collar vs its own 7-day pattern.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Card, Chip, ChoiceChips, EmptyState, Header, LineChart, LoadingList, Screen, SourceBadge } from '@/components';
import { useDevices, useSeries } from '@/features/iot/api';
import { useAnimals } from '@/features/livestock/api';
import { anomaly } from '@/features/livestock/insights';
import { axisFormat } from '@/lib/dates';
import { colors } from '@/theme';

export default function Activity() {
  const { t, i18n } = useTranslation();
  const q = useDevices(); const animals = useAnimals();
  const collars = (q.data?.devices ?? []).filter((d) => d.kind === 'collar' && d.animal_id);
  const [sel, setSel] = useState<string | null>(null);
  const [type, setType] = useState<'activity' | 'rumination'>('activity');
  const collar = collars.find((c) => c.id === sel) ?? collars[0];
  const s = useSeries(collar ? { sensorType: type, hours: 168, deviceId: collar.id } : null);
  const pts = useMemo(() => (s.data ?? []).map((p) => ({ x: Date.parse(p.bucket), y: Number(p.avg_value) })), [s.data]);
  if (q.isLoading) return <Screen><Header title={t('herd.activityTitle')} /><LoadingList /></Screen>;
  if (!collar) return <Screen><Header title={t('herd.activityTitle')} /><EmptyState icon="directions-walk" title={t('herd.noCollars')} text={t('herd.noCollarsText')} action={t('monitor.addDevice')} onAction={() => router.push('/monitor/add')} /></Screen>;
  const a = anomaly(pts);
  const name = (id: string | null) => { const x = animals.data?.find((v) => v.id === id); return x?.name ?? x?.tag_id ?? ''; };
  return (
    <Screen>
      <Header title={t('herd.activityTitle')} />
      {collars.length > 1 && <ChoiceChips scroll value={collar.id} onChange={setSel} options={collars.map((c) => ({ value: c.id, label: name(c.animal_id) || c.name }))} />}
      <ChoiceChips value={type} onChange={setType} options={[{ value: 'activity', label: t('sensors.activity') }, { value: 'rumination', label: t('sensors.rumination') }]} />
      {s.isLoading ? <LoadingList count={1} height={180} /> : pts.length < 2 ? <Banner message={t('devices.noHistory')} /> : (
        <Card style={{ gap: 8 }}>
          <LineChart series={[{ points: pts, color: colors.primary, label: t(`sensors.${type}`) }]} formatX={axisFormat(168, i18n.language)} />
          {a ? (
            <>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <Chip tone={a.flag ? 'error' : 'normal'} label={t(a.flag ? `herd.flag.${a.flag}` : 'herd.flag.normal')} />
                <Chip tone="dark" label={t('herd.vsBaseline', { change: `${a.change > 0 ? '+' : ''}${a.change}` })} />
              </View>
              <AppText variant="bodyMd">{t(a.flag === 'drop' ? `herd.dropAdvice.${type}` : a.flag === 'rise' ? 'herd.riseAdvice' : 'herd.normalAdvice')}</AppText>
            </>
          ) : <AppText color={colors.textMuted}>{t('herd.needWeek')}</AppText>}
          {s.data?.some((p) => p.sources.includes('simulated')) && <SourceBadge source="simulated" />}
        </Card>
      )}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('herd.anomalyNote')}</AppText>
    </Screen>
  );
}
