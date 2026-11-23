// Safe areas (geofences) — design: gps_livestock_location_geofencing. A collar outside every safe area raises an alert.
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, EmptyState, Header, LoadingList, Screen, SectionHeader, TextField, TileMap } from '@/components';
import { areaHa, centroid, LonLat } from '@/components/TileMap';
import { useAnimalLocations, useAnimals, useDeleteGeofence, useGeofences, useSaveGeofence } from '@/features/livestock/api';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

export default function Geofences() {
  const { t } = useTranslation();
  const profile = useSession((s) => s.profile);
  const fences = useGeofences();
  const locs = useAnimalLocations();
  const animals = useAnimals();
  const save = useSaveGeofence();
  const del = useDeleteGeofence();
  const [draft, setDraft] = useState<LonLat[] | null>(null);
  const [name, setName] = useState('');
  // Latest position per animal.
  const latest = [...new Map((locs.data ?? []).map((l) => [l.animal_id, l])).values()];
  const firstFence = fences.data?.[0]?.polygon;
  const center = draft?.length ? centroid(draft) : firstFence ? centroid(firstFence) : latest[0] ? { lat: latest[0].latitude, lon: latest[0].longitude }
    : profile?.latitude != null && profile.longitude != null ? { lat: profile.latitude, lon: profile.longitude } : null;

  const submit = async () => {
    if (!draft || draft.length < 3 || !name.trim()) return;
    try { await save.mutateAsync({ name: name.trim(), polygon: draft }); setDraft(null); setName(''); } catch { Alert.alert(t('errors.generic')); }
  };

  return (
    <Screen>
      <Header title={t('geofence.title')} />
      <Banner message={t('geofence.help')} />
      {fences.isLoading ? <LoadingList count={1} height={260} /> : !center ? <Banner tone="warning" message={t('field.noLocation')} /> : (
        <TileMap center={center} zoom={16} height={300}
          polygons={[...(fences.data ?? []).map((f) => ({ points: f.polygon })), ...(draft ? [{ points: draft, color: colors.warning }] : [])]}
          markers={latest.map((l) => ({ lat: l.latitude, lon: l.longitude, label: animals.data?.find((a) => a.id === l.animal_id)?.name ?? '' }))}
          onPress={draft ? (p) => setDraft([...draft, [p.lon, p.lat]]) : undefined} />
      )}
      {draft ? (
        <Card style={{ gap: 8 }}>
          <AppText variant="bodySm" color={colors.textMuted}>{t('field.drawHelp')}</AppText>
          {draft.length >= 3 && <AppText variant="labelMd">{t('field.area', { ha: areaHa(draft).toFixed(2), acres: (areaHa(draft) * 2.471).toFixed(2) })}</AppText>}
          <TextField label={t('geofence.name')} value={name} onChangeText={setName} placeholder={t('geofence.namePlaceholder')} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button compact variant="text" iconLeft="undo" label={t('field.undo')} onPress={() => setDraft(draft.slice(0, -1))} />
            <Button compact variant="text" iconLeft="close" label={t('common.cancel')} onPress={() => setDraft(null)} />
          </View>
          <Button iconLeft="check" label={t('common.save')} disabled={draft.length < 3 || !name.trim()} loading={save.isPending} onPress={submit} />
        </Card>
      ) : <Button iconLeft="draw" label={t('geofence.add')} onPress={() => setDraft([])} disabled={!center} />}

      <SectionHeader title={t('geofence.list')} />
      {!fences.data?.length ? <EmptyState icon="fence" title={t('geofence.none')} /> : fences.data.map((f) => (
        <Card key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <AppText variant="labelLg">{f.name}</AppText>
            <AppText variant="bodySm" color={colors.textMuted}>{t('field.area', { ha: areaHa(f.polygon).toFixed(2), acres: (areaHa(f.polygon) * 2.471).toFixed(2) })}</AppText>
          </View>
          <Button compact variant="text" iconLeft="delete-outline" label={t('common.delete')}
            onPress={() => Alert.alert(t('geofence.deleteTitle'), '', [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.delete'), style: 'destructive', onPress: () => del.mutate(f.id) }])} />
        </Card>
      ))}
    </Screen>
  );
}
