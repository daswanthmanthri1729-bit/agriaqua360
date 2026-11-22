// 26 · Livestock Dashboard — Stitch: 06_home_dashboard "Livestock Hub" card, extended in the same system
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Banner, Card, EmptyState, ErrorState, Header, Icon, IconName, LoadingList, SectionHeader } from '@/components';
import { useAnimals, useVaccinations } from '@/features/livestock/api';
import { AnimalRow, SPECIES_EMOJI } from '@/features/livestock/AnimalRow';
import { SPECIES } from '@/features/livestock/schemas';
import { VaccRow } from '@/features/livestock/VaccRow';
import { vaccState } from '@/features/livestock/vaccination';
import { today } from '@/lib/dates';
import { colors, radius, space } from '@/theme';

export default function LivestockDashboard() {
  const { t } = useTranslation();
  const animals = useAnimals();
  const vaccs = useVaccinations();
  const now = today();
  const herd = (animals.data ?? []).filter((a) => a.status !== 'sold' && a.status !== 'deceased');
  const care = herd.filter((a) => a.status === 'sick' || a.status === 'under_treatment');
  const due = (vaccs.data ?? []).filter((v) => ['overdue', 'due_soon'].includes(vaccState(v, now)));

  const actions: { label: string; icon: IconName; href: string }[] = [
    { label: t('livestock.addAnimal'), icon: 'add-circle-outline', href: '/livestock/animals/new' },
    { label: t('livestock.allAnimals'), icon: 'pets', href: '/livestock/animals' },
    { label: t('livestock.healthRecords'), icon: 'medical-services', href: '/livestock/records' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl }}
        refreshControl={<RefreshControl refreshing={animals.isRefetching} onRefresh={() => { animals.refetch(); vaccs.refetch(); }} colors={[colors.primary]} />}>
        <Header title={t('livestock.title')} />
        <AppText variant="bodyLg" color={colors.textMuted}>{t('livestock.subtitle')}</AppText>
        {animals.isLoading ? <LoadingList count={3} height={100} /> : animals.error && !animals.data ? <ErrorState onRetry={() => animals.refetch()} /> : !animals.data?.length ? (
          <EmptyState icon="pets" title={t('livestock.emptyTitle')} text={t('livestock.emptyText')} action={t('livestock.addAnimal')} onAction={() => router.push('/livestock/animals/new')} />
        ) : (
          <>
            <View style={styles.row}>
              {[[t('livestock.animals'), herd.length, colors.text], [t('livestock.sick'), care.length, care.length ? colors.error : colors.text], [t('livestock.dueVacc'), due.length, due.length ? colors.warning : colors.text]].map(([l, v, c]) => (
                <Card key={l as string} style={styles.stat}>
                  <AppText variant="labelSm" color={colors.textSubtle} numberOfLines={1}>{l}</AppText>
                  <AppText variant="headlineMd" color={c as string}>{v}</AppText>
                </Card>
              ))}
            </View>
            <View style={styles.row}>
              {actions.map((a) => (
                <Card key={a.href} onPress={() => router.push(a.href as never)} accessibilityLabel={a.label} style={styles.action}>
                  <View style={styles.actionIcon}><Icon name={a.icon} size={26} color={colors.primaryDeep} /></View>
                  <AppText variant="labelMd" align="center" numberOfLines={2}>{a.label}</AppText>
                </Card>
              ))}
            </View>

            <SectionHeader title={t('livestock.bySpecies')} />
            <View style={[styles.row, { flexWrap: 'wrap' }]}>
              {SPECIES.map((s) => {
                const n = herd.filter((a) => a.species === s).length;
                return n ? (
                  <Card key={s} onPress={() => router.push({ pathname: '/livestock/animals', params: { species: s } })} accessibilityLabel={`${t(`livestock.species.${s}`)} ${n}`} style={styles.species}>
                    <AppText style={{ fontSize: 26, lineHeight: 32 }}>{SPECIES_EMOJI[s]}</AppText>
                    <AppText variant="labelLg">{t(`livestock.species.${s}`)}</AppText>
                    <AppText variant="headlineSm">{n}</AppText>
                  </Card>
                ) : null;
              })}
            </View>

            <SectionHeader title={t('livestock.upcoming')} />
            <Card style={{ paddingVertical: 4 }}>
              {due.length ? due.map((v) => <VaccRow key={v.id} v={v} showAnimal />) : <AppText variant="bodyMd" color={colors.textMuted} style={{ paddingVertical: 12 }}>{t('livestock.noUpcoming')}</AppText>}
            </Card>

            <SectionHeader title={t('livestock.needCare')} />
            {care.length ? care.map((a) => <AnimalRow key={a.id} a={a} onPress={() => router.push(`/livestock/animals/${a.id}`)} />)
              : <Banner tone="success" message={t('livestock.noneSick')} />}
            <Banner tone="info" message={t('livestock.consultVet')} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12, gap: 2 },
  action: { flex: 1, alignItems: 'center', gap: 8, padding: 12 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  species: { minWidth: 100, flexGrow: 1, alignItems: 'center', gap: 2, padding: 12, borderRadius: radius.lg },
});
