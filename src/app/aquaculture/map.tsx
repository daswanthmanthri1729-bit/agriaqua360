// Pond map — design: smart_pond_management_mapping. Ponds on the map coloured by water status.
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, EmptyState, Header, LoadingList, Screen, TileMap } from '@/components';
import { fitZoom } from '@/components/TileMap';
import { usePonds, useUpdatePond } from '@/features/aquaculture/api';
import { gpsPoint } from '@/services/location';
import { overall } from '@/features/aquaculture/waterQuality';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

const COLOR = { ok: colors.secondary, warn: colors.warning, bad: colors.error } as const;

export default function PondMap() {
  const { t } = useTranslation();
  const ponds = usePonds(); const profile = useSession((s) => s.profile);
  const update = useUpdatePond();
  const here = async (id: string) => {
    try { const p = await gpsPoint(); await update.mutateAsync({ id, patch: { latitude: p.lat, longitude: p.lon } }); }
    catch { Alert.alert(t('profileSetup.locationFailed')); }
  };
  if (ponds.isLoading) return <Screen><Header title={t('aquaX.mapTitle')} /><LoadingList /></Screen>;
  const list = ponds.data ?? [];
  if (!list.length) return <Screen><Header title={t('aquaX.mapTitle')} /><EmptyState icon="water" title={t('aquaX.noPond')} action={t('aquaX.addPond')} onAction={() => router.push('/aquaculture/ponds')} /></Screen>;
  const located = list.filter((p) => p.latitude != null && p.longitude != null);
  const center = located[0] ? { lat: located[0].latitude!, lon: located[0].longitude! } : profile?.latitude != null ? { lat: profile.latitude, lon: profile.longitude! } : null;
  return (
    <Screen>
      <Header title={t('aquaX.mapTitle')} />
      {center ? (
        <TileMap center={center} zoom={located.length > 1 ? fitZoom(located.map((p) => [p.longitude!, p.latitude!]), 360, 280) : 15} height={280}
          markers={located.map((p) => { const lv = p.latest ? overall(p.latest) : null; return { lat: p.latitude!, lon: p.longitude!, label: p.name, color: lv ? COLOR[lv] : colors.water }; })} />
      ) : <Banner tone="warning" message={t('field.noLocation')} />}
      {located.length < list.length && <Banner message={t('aquaX.addPondLocation')} />}
      {list.map((p) => {
        const lv = p.latest ? overall(p.latest) : null;
        return (
          <Card key={p.id} onPress={() => router.push(`/aquaculture/ponds/${p.id}`)} accessibilityLabel={p.name} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: lv ? COLOR[lv] : colors.outline }} />
            <View style={{ flex: 1 }}>
              <AppText variant="labelLg">{p.name}</AppText>
              <AppText variant="bodySm" color={colors.textMuted}>{[p.species, p.area_acres != null && `${p.area_acres} ${t('common.acresShort')}`, p.latitude == null && t('aquaX.noGps')].filter(Boolean).join(' · ')}</AppText>
            </View>
            {lv && <Chip tone={lv === 'ok' ? 'normal' : lv === 'warn' ? 'warning' : 'error'} label={t(`water.status.${lv}`)} />}
            {p.latitude == null && <Button compact variant="text" iconLeft="my-location" label={t('aquaX.setHere')} loading={update.isPending} onPress={() => here(p.id)} />}
          </Card>
        );
      })}
    </Screen>
  );
}
