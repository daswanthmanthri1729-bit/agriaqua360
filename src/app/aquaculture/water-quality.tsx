// 24 · Water Quality Records — Stitch: 32_water_quality_dashboard, 33_add_water_quality_reading, 34_water_quality_risk_analysis
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, EmptyState, ErrorState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { usePonds, useReadings } from '@/features/aquaculture/api';
import { AddReadingSheet } from '@/features/aquaculture/AddReadingSheet';
import { WaterTiles } from '@/features/aquaculture/WaterTiles';
import { adviceKey, overall, PARAMS } from '@/features/aquaculture/waterQuality';
import { colors } from '@/theme';

const TONE = { ok: 'normal', warn: 'warning', bad: 'error' } as const;

export default function WaterQuality() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ pondId?: string; add?: string }>();
  const ponds = usePonds();
  const [pondId, setPondId] = useState<string>(params.pondId ?? 'all');
  const readings = useReadings(pondId === 'all' ? undefined : pondId);
  const [open, setOpen] = useState(params.add === '1');
  const pondList = (ponds.data ?? []).map((p) => ({ id: p.id, name: p.name }));
  const name = (id: string) => pondList.find((p) => p.id === id)?.name ?? '';
  const latest = readings.data?.[0];
  const when = (iso: string) => new Date(iso).toLocaleString(i18n.language === 'en' ? 'en-IN' : `${i18n.language}-IN`, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <Screen footer={pondList.length ? <Button testID="wq-add" label={t('water.add')} iconLeft="add" onPress={() => setOpen(true)} /> : undefined}>
      <Header title={t('water.title')} />
      {pondList.length > 1 && (
        <ChoiceChips scroll value={pondId} onChange={setPondId} options={[{ value: 'all', label: t('crops.all') }, ...pondList.map((p) => ({ value: p.id, label: p.name }))]} />
      )}
      {readings.isLoading || ponds.isLoading ? <LoadingList height={120} /> : readings.error && !readings.data ? <ErrorState onRetry={() => readings.refetch()} /> : !pondList.length ? (
        <EmptyState icon="water" title={t('aqua.emptyTitle')} text={t('aqua.emptyText')} />
      ) : !latest ? <EmptyState icon="science" title={t('water.empty')} text={t('water.meterNote')} action={t('water.add')} onAction={() => setOpen(true)} /> : (
        <>
          <SectionHeader title={`${t('aqua.latest')} · ${name(latest.pond_id)}`} />
          <AppText variant="bodySm" color={colors.textSubtle}>{when(latest.recorded_at)}</AppText>
          <WaterTiles reading={latest} />
          {PARAMS.map((p) => (latest[p.key] != null ? adviceKey(p.key, latest[p.key]!) : null)).filter(Boolean).map((k) => <Banner key={k} tone="warning" message={t(k!)} />)}
          <AppText variant="bodySm" color={colors.textSubtle}>{t('water.guideNote')}</AppText>

          <SectionHeader title={t('water.history')} />
          <Card style={{ gap: 12 }}>
            {readings.data!.map((r) => {
              const l = overall(r);
              return (
                <View key={r.id} style={{ gap: 4, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <AppText variant="labelLg" style={{ flex: 1 }}>{when(r.recorded_at)}{pondId === 'all' ? ` · ${name(r.pond_id)}` : ''}</AppText>
                    {l && <Chip tone={TONE[l]} label={t(`water.status.${l}`)} />}
                  </View>
                  <AppText variant="bodySm" color={colors.textMuted}>
                    {PARAMS.filter((p) => r[p.key] != null).map((p) => `${t(`water.params.${p.key}`)} ${r[p.key]}${p.unit === 'pH' ? '' : ` ${p.unit}`}`).join(' • ')}
                  </AppText>
                  {!!r.notes && <AppText variant="bodySm">{r.notes}</AppText>}
                </View>
              );
            })}
          </Card>
        </>
      )}
      <AddReadingSheet visible={open} onClose={() => setOpen(false)} ponds={pondList} pondId={pondId === 'all' ? undefined : pondId} />
    </Screen>
  );
}
