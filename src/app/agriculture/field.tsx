// Field monitoring — designs: field_monitoring_management, crop_health_risk_analysis (satellite part).
// Farm boundary (tap on map or walk it with GPS) → Sentinel-2 NDVI history. No satellite data is ever invented:
// cloudy passes are skipped, every point shows its date, cloud cover, resolution and source.
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  AppText, Banner, Button, Card, Chip, ChoiceChips, EmptyState, Freshness, Header, LineChart, LoadingList, Screen, SectionHeader, SourceBadge, StorageImage, TileMap,
} from '@/components';
import { areaHa, centroid, fitZoom, LonLat } from '@/components/TileMap';
import { useFarms } from '@/features/agriculture/api';
import { useNdviImage, useSatellite, useSaveBoundary } from '@/features/intel/api';
import { ndviClass } from '@/features/intel/agronomy';
import { farmPoint } from '@/features/intel/place';
import { gpsPoint, LocationDeniedError } from '@/services/location';
import { useSession } from '@/store/session';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';

const NDVI_TONE = { bare: 'error', sparse: 'warning', moderate: 'normal', dense: 'normal' } as const;

export default function Field() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ farm?: string }>();
  const profile = useSession((s) => s.profile);
  const farms = useFarms();
  const [farmId, setFarmId] = useState<string | null>(params.farm ?? null);
  const farm = farms.data?.find((f) => f.id === (farmId ?? farms.data?.[0]?.id));
  const saved = farm?.boundary ?? null;
  const [draft, setDraft] = useState<LonLat[] | null>(null);
  const [walking, setWalking] = useState(false);
  const save = useSaveBoundary();
  const sat = useSatellite(farm?.id ?? null, !!saved && saved.length >= 3 && !draft);
  const image = useNdviImage();
  const obs = useMemo(() => [...(sat.data?.observations ?? [])].reverse(), [sat.data]);
  const latest = sat.data?.observations?.[0];
  const pts = obs.filter((o) => o.ndvi_mean != null).map((o) => ({ x: Date.parse(o.acquired_at), y: Number(o.ndvi_mean), lo: Number(o.ndvi_min), hi: Number(o.ndvi_max) }));

  if (farms.isLoading) return <Screen><Header title={t('field.title')} /><LoadingList /></Screen>;
  if (!farms.data?.length || !farm) return <Screen><Header title={t('field.title')} /><EmptyState icon="add-location-alt" title={t('soil.noFarm')} action={t('dashboard.addFarm')} onAction={() => router.push('/agriculture/farms/new')} /></Screen>;

  const shape = draft ?? saved ?? [];
  const here = shape.length ? centroid(shape) : farmPoint(farm, profile);
  const addWalkPoint = async () => {
    setWalking(true);
    try {
      const p = await gpsPoint();
      if (p.accuracy != null && p.accuracy > 25) Alert.alert(t('field.lowAccuracy', { m: Math.round(p.accuracy) }));
      setDraft([...(draft ?? []), [p.lon, p.lat]]);
    } catch (e) { Alert.alert(t(e instanceof LocationDeniedError ? 'profileSetup.locationDenied' : 'profileSetup.locationFailed')); }
    finally { setWalking(false); }
  };
  const saveDraft = async () => {
    if (!draft || draft.length < 3) return;
    const ha = areaHa(draft);
    if (ha > 1000) { Alert.alert(t('field.tooLarge')); return; }
    try { await save.mutateAsync({ farmId: farm.id, boundary: draft, area: Math.round(ha * 1000) / 1000 }); setDraft(null); } catch { Alert.alert(t('errors.generic')); }
  };

  return (
    <Screen>
      <Header title={t('field.title')} />
      {farms.data.length > 1 && <ChoiceChips scroll value={farm.id} onChange={(v) => { setFarmId(v); setDraft(null); }} options={farms.data.map((f) => ({ value: f.id, label: f.name }))} />}

      {!here ? <Banner tone="warning" message={t('field.noLocation')} /> : (
        <TileMap key={`${farm.id}${saved?.length ?? 0}`} center={here} zoom={shape.length >= 3 ? fitZoom(shape, 360, 280) : 16} height={280}
          polygons={shape.length ? [{ points: shape, color: draft ? colors.warning : colors.primary }] : []}
          onPress={draft ? (p) => setDraft([...draft, [p.lon, p.lat]]) : undefined}
          accessibilityLabel={t('field.mapLabel', { name: farm.name })} />
      )}

      {draft ? (
        <Card style={{ gap: 8 }}>
          <AppText variant="labelLg">{t('field.drawing', { count: draft.length })}</AppText>
          <AppText variant="bodySm" color={colors.textMuted}>{t('field.drawHelp')}</AppText>
          {draft.length >= 3 && <AppText variant="labelMd">{t('field.area', { ha: areaHa(draft).toFixed(2), acres: (areaHa(draft) * 2.471).toFixed(2) })}</AppText>}
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Button compact variant="secondary" iconLeft="my-location" label={t('field.addGps')} loading={walking} onPress={addWalkPoint} />
            <Button compact variant="text" iconLeft="undo" label={t('field.undo')} onPress={() => setDraft(draft.slice(0, -1))} disabled={!draft.length} />
            <Button compact variant="text" iconLeft="close" label={t('common.cancel')} onPress={() => setDraft(null)} />
          </View>
          <Button iconLeft="check" label={t('field.saveBoundary')} disabled={draft.length < 3} loading={save.isPending} onPress={saveDraft} />
        </Card>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {saved && saved.length >= 3 && <Chip icon="square-foot" label={t('field.area', { ha: Number(farm.boundary_area_ha ?? areaHa(saved)).toFixed(2), acres: (Number(farm.boundary_area_ha ?? areaHa(saved)) * 2.471).toFixed(2) })} />}
          <Button compact variant="secondary" iconLeft="draw" label={t(saved ? 'field.redraw' : 'field.draw')} onPress={() => setDraft([])} />
        </View>
      )}

      <SectionHeader title={t('field.satTitle')} />
      {!saved || saved.length < 3 ? <Banner message={t('field.needBoundary')} /> : sat.isLoading ? <LoadingList count={1} height={180} /> : sat.error ? (
        <Banner tone="warning" message={t(sat.error.message)} />
      ) : sat.data && !sat.data.configured ? <Banner tone="warning" title={t('field.notConfiguredTitle')} message={t('field.notConfigured')} /> : !latest ? (
        <Banner message={t('field.noScenes')} />
      ) : (
        <>
          <Card style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <AppText variant="headlineMd">NDVI {latest.ndvi_mean}</AppText>
              {ndviClass(latest.ndvi_mean) && <Chip tone={NDVI_TONE[ndviClass(latest.ndvi_mean)!]} label={t(`field.ndvi.${ndviClass(latest.ndvi_mean)}`)} />}
            </View>
            <AppText variant="bodySm" color={colors.textMuted}>
              {t('field.sceneMeta', { date: formatDate(latest.acquired_at.slice(0, 10), i18n.language), cloud: latest.cloud_pct ?? '—', res: latest.resolution_m })}
            </AppText>
            {latest.stress_pct != null && <AppText variant="bodyMd" color={latest.stress_pct > 20 ? colors.warning : colors.text}>{t('field.stress', { pct: latest.stress_pct })}</AppText>}
            {image.data?.path ? <StorageImage path={image.data.path} style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }} label={t('field.ndviImage')} />
              : <Button compact variant="secondary" iconLeft="image" label={t('field.showImage')} loading={image.isPending} onPress={() => image.mutate({ farmId: farm.id, date: latest.acquired_at.slice(0, 10) }, { onError: (e) => Alert.alert(t(e.message)) })} />}
            {image.data?.path && <AppText variant="labelSm" color={colors.textSubtle}>{t('field.legend')}</AppText>}
          </Card>
          {pts.length > 1 && (
            <Card style={{ gap: 6 }}>
              <AppText variant="labelLg">{t('field.history')}</AppText>
              <LineChart series={[{ points: pts, label: 'NDVI', color: colors.secondary }]} yMin={0} yMax={1} formatX={(x) => formatDate(new Date(x).toISOString().slice(0, 10), i18n.language, { day: 'numeric', month: 'short' })} />
              <AppText variant="labelSm" color={colors.textSubtle}>{t('field.historyNote', { count: pts.length })}</AppText>
            </Card>
          )}
          <SourceBadge source="api" label={sat.data?.provider ?? 'Sentinel-2'} />
          <Freshness at={sat.data?.fetched_at} staleAfterMin={24 * 60} />
        </>
      )}
    </Screen>
  );
}
