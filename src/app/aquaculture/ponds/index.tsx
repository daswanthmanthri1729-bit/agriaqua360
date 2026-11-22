// 22 · Pond Management — Stitch: 26_my_ponds (add-pond form in a bottom sheet)
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, DateField, EmptyState, ErrorState, Header, Icon, LoadingList, Sheet, TextField } from '@/components';
import { useCreatePond, usePonds } from '@/features/aquaculture/api';
import { POND_STATUS, pondSchema, PondInput, SPECIES } from '@/features/aquaculture/schemas';
import { overall } from '@/features/aquaculture/waterQuality';
import { toErrorKey } from '@/features/auth/api';
import { daysBetween, today } from '@/lib/dates';
import { colors, radius, space } from '@/theme';

const TONE = { ok: 'normal', warn: 'warning', bad: 'error' } as const;

export default function PondManagement() {
  const { t } = useTranslation();
  const { add } = useLocalSearchParams<{ add?: string }>();
  const ponds = usePonds();
  const [open, setOpen] = useState(add === '1');
  const [filter, setFilter] = useState<'all' | (typeof POND_STATUS)[number]>('all');
  const list = (ponds.data ?? []).filter((p) => filter === 'all' || p.status === filter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <FlatList
        data={ponds.isLoading || ponds.error ? [] : list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space.md, gap: 12, paddingBottom: 100 }}
        ListHeaderComponent={
          <View style={{ gap: space.md, marginBottom: 4 }}>
            <Header title={t('ponds.title')} />
            <ChoiceChips scroll value={filter} onChange={setFilter}
              options={[{ value: 'all', label: t('crops.all') }, ...POND_STATUS.map((s) => ({ value: s, label: t(`ponds.statuses.${s}`) }))]} />
          </View>
        }
        renderItem={({ item: p }) => {
          const l = p.latest ? overall(p.latest) : null;
          const doc = p.stocking_date && p.status === 'active' ? daysBetween(p.stocking_date, today()) : null;
          return (
            <Card onPress={() => router.push(`/aquaculture/ponds/${p.id}`)} accessibilityLabel={p.name} style={styles.row}>
              <View style={styles.icon}><Icon name="water" size={28} color={colors.water} /></View>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="headlineSm" numberOfLines={1}>{p.name}</AppText>
                <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                  {[p.species, p.area_acres != null && `${p.area_acres} ${t('common.acres')}`].filter(Boolean).join(' • ') || '—'}
                </AppText>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Chip label={t(`ponds.statuses.${p.status}`)} />
                  {doc != null && doc >= 0 && <Chip tone="ai" label={t('aqua.doc', { count: doc })} />}
                  {l && <Chip tone={TONE[l]} label={t(`water.status.${l}`)} />}
                </View>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          ponds.isLoading ? <LoadingList height={96} /> : ponds.error ? <ErrorState onRetry={() => ponds.refetch()} /> : (
            <EmptyState icon="water" title={t('aqua.emptyTitle')} text={t('aqua.emptyText')} action={t('ponds.add')} onAction={() => setOpen(true)} />
          )
        }
      />
      {!!ponds.data?.length && <View style={styles.fab}><Button testID="pond-add" label={t('ponds.add')} iconLeft="add" onPress={() => setOpen(true)} /></View>}
      <AddPondSheet visible={open} onClose={() => setOpen(false)} />
    </SafeAreaView>
  );
}

function AddPondSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreatePond();
  const [error, setError] = useState<string | null>(null);
  const defaults: PondInput = { name: '', species: '', area_acres: '', depth_m: '', stocking_date: '', stocking_count: '', status: 'active', notes: '' };
  const { control, handleSubmit, reset, formState: { errors } } = useForm<PondInput>({ resolver: zodResolver(pondSchema), defaultValues: defaults });
  useEffect(() => { if (visible) { reset(defaults); setError(null); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const err = (e?: { message?: string }) => (e?.message ? t(e.message) : undefined);

  const save = handleSubmit(async (input) => {
    try {
      const pond = await create.mutateAsync(input);
      onClose();
      router.push(`/aquaculture/ponds/${pond.id}`);
    } catch (e) { setError(toErrorKey(e)); }
  });

  const num = (name: 'area_acres' | 'depth_m' | 'stocking_count', label: string) => (
    <Controller control={control} name={name} render={({ field }) => (
      <TextField label={label} keyboardType={name === 'stocking_count' ? 'number-pad' : 'decimal-pad'} value={field.value} onChangeText={field.onChange} error={err(errors[name])} />
    )} />
  );

  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('ponds.add')}</AppText>
      <Controller control={control} name="name" render={({ field }) => (
        <TextField testID="pond-name" label={t('ponds.name')} required icon="water" placeholder={t('ponds.namePlaceholder')} value={field.value} onChangeText={field.onChange} error={err(errors.name)} />
      )} />
      <Controller control={control} name="species" render={({ field }) => (
        <View style={{ gap: 8 }}>
          <TextField label={t('ponds.species')} placeholder={t('ponds.speciesPlaceholder')} value={field.value} onChangeText={field.onChange} error={err(errors.species)} />
          <ChoiceChips scroll value={null} onChange={(k) => field.onChange(t(`ponds.speciesList.${k}`))} options={SPECIES.map((k) => ({ value: k, label: t(`ponds.speciesList.${k}`) }))} />
        </View>
      )} />
      <View style={styles.two}><View style={{ flex: 1 }}>{num('area_acres', t('ponds.area'))}</View><View style={{ flex: 1 }}>{num('depth_m', t('ponds.depth'))}</View></View>
      <Controller control={control} name="stocking_date" render={({ field }) => (
        <DateField label={t('ponds.stockingDate')} value={field.value} onChange={field.onChange} error={err(errors.stocking_date)} />
      )} />
      {num('stocking_count', t('ponds.stockingCount'))}
      <Controller control={control} name="status" render={({ field }) => (
        <ChoiceChips label={t('ponds.status')} value={field.value} onChange={field.onChange} options={POND_STATUS.map((s) => ({ value: s, label: t(`ponds.statuses.${s}`) }))} />
      )} />
      {error && <Banner tone="error" message={t(error)} />}
      <Button testID="pond-save" label={t('ponds.save')} iconLeft="check" loading={create.isPending} onPress={save} />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12 },
  icon: { width: 60, height: 60, borderRadius: radius.lg, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' },
  fab: { position: 'absolute', right: space.md, bottom: space.lg },
  two: { flexDirection: 'row', gap: 12 },
});
