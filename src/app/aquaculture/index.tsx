// 21 · Aquaculture Dashboard — Stitch: 32_water_quality_dashboard + 26_my_ponds
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Banner, Button, Card, Chip, EmptyState, ErrorState, Icon, IconName, LoadingList, BackButton, SectionHeader } from '@/components';
import { usePonds } from '@/features/aquaculture/api';
import { AddReadingSheet } from '@/features/aquaculture/AddReadingSheet';
import { adviceKey, overall, PARAMS } from '@/features/aquaculture/waterQuality';
import { daysBetween, formatDate, isoDate, today } from '@/lib/dates';
import { colors, radius, space } from '@/theme';

const TONE = { ok: 'normal', warn: 'warning', bad: 'error' } as const;

export default function AquacultureDashboard() {
  const { t, i18n } = useTranslation();
  const ponds = usePonds();
  const [readingOpen, setReadingOpen] = useState(false);
  const list = ponds.data ?? [];
  const active = list.filter((p) => p.status === 'active');
  const alerts = list.flatMap((p) =>
    p.latest ? PARAMS.map((x) => (p.latest![x.key] != null ? adviceKey(x.key, p.latest![x.key]!) : null)).filter(Boolean).map((k) => ({ pond: p.name, key: k! })) : [],
  );

  const actions: { label: string; icon: IconName; onPress: () => void }[] = [
    { label: t('aqua.addPond'), icon: 'add-circle-outline', onPress: () => router.push({ pathname: '/aquaculture/ponds', params: { add: '1' } }) },
    { label: t('aqua.addReading'), icon: 'science', onPress: () => setReadingOpen(true) },
    { label: t('aqua.scanFish'), icon: 'set-meal', onPress: () => router.push('/aquaculture/fish-scan') },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl }}
        refreshControl={<RefreshControl refreshing={ponds.isRefetching} onRefresh={() => { ponds.refetch(); }} colors={[colors.primary]} />}>
        <View style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BackButton />
            <AppText variant="display" accessibilityRole="header" style={{ flex: 1 }}>{t('aqua.title')}</AppText>
          </View>
          <AppText variant="bodyLg" color={colors.textMuted}>{t('aqua.subtitle')}</AppText>
        </View>

        {ponds.isLoading ? <LoadingList count={3} height={110} /> : ponds.error && !ponds.data ? <ErrorState onRetry={() => ponds.refetch()} /> : !list.length ? (
          <EmptyState icon="water" title={t('aqua.emptyTitle')} text={t('aqua.emptyText')} action={t('aqua.addPond')}
            onAction={() => router.push({ pathname: '/aquaculture/ponds', params: { add: '1' } })} />
        ) : (
          <>
            <View style={styles.row}>
              {[[t('aqua.ponds'), list.length], [t('aqua.active'), active.length], [t('aqua.alerts'), alerts.length]].map(([l, v]) => (
                <Card key={l as string} style={styles.stat}>
                  <AppText variant="labelSm" color={colors.textSubtle}>{l}</AppText>
                  <AppText variant="headlineMd" color={l === t('aqua.alerts') && alerts.length ? colors.error : colors.text}>{v}</AppText>
                </Card>
              ))}
            </View>
            <View style={styles.row}>
              {actions.map((a) => (
                <Card key={a.label} onPress={a.onPress} accessibilityLabel={a.label} style={styles.action}>
                  <View style={styles.actionIcon}><Icon name={a.icon} size={26} color={colors.primaryDeep} /></View>
                  <AppText variant="labelMd" align="center" numberOfLines={2}>{a.label}</AppText>
                </Card>
              ))}
            </View>

            <SectionHeader title={t('aqua.alerts')} />
            {alerts.length ? alerts.map((a, i) => <Banner key={i} tone="warning" title={a.pond} message={t(a.key)} />)
              : list.some((p) => p.latest) ? <Banner tone="success" message={t('aqua.allGood')} /> : <Banner message={t('aqua.noReadings')} />}

            <SectionHeader title={t('aqua.latest')} action={t('aqua.viewPonds')} onAction={() => router.push('/aquaculture/ponds')} />
            {list.map((p) => {
              const l = p.latest ? overall(p.latest) : null;
              const doc = p.stocking_date && p.status === 'active' ? daysBetween(p.stocking_date, today()) : null;
              return (
                <Card key={p.id} onPress={() => router.push(`/aquaculture/ponds/${p.id}`)} accessibilityLabel={p.name} style={{ gap: 8 }}>
                  <View style={[styles.row, { alignItems: 'center' }]}>
                    <View style={styles.pondIcon}><Icon name="water" color={colors.water} /></View>
                    <View style={{ flex: 1 }}>
                      <AppText variant="headlineSm" numberOfLines={1}>{p.name}</AppText>
                      <AppText variant="bodySm" color={colors.textMuted} numberOfLines={1}>
                        {[p.species, doc != null && doc >= 0 ? t('aqua.doc', { count: doc }) : null].filter(Boolean).join(' • ')}
                      </AppText>
                    </View>
                    {l && <Chip tone={TONE[l]} label={t(`water.status.${l}`)} />}
                  </View>
                  {p.latest ? (
                    <AppText variant="bodyMd" color={colors.textMuted}>
                      {PARAMS.filter((x) => p.latest![x.key] != null).slice(0, 3).map((x) => `${t(`water.params.${x.key}`)} ${p.latest![x.key]}`).join(' • ')}
                      {'\n'}{t('aqua.readingAge', { date: formatDate(isoDate(new Date(p.latest.recorded_at)), i18n.language) })}
                    </AppText>
                  ) : <AppText variant="bodyMd" color={colors.textMuted}>{t('water.empty')}</AppText>}
                </Card>
              );
            })}
            <Button variant="secondary" iconLeft="history" label={t('water.title')} onPress={() => router.push('/aquaculture/water-quality')} />
          </>
        )}
      </ScrollView>
      <AddReadingSheet visible={readingOpen} onClose={() => setReadingOpen(false)} ponds={list.map((p) => ({ id: p.id, name: p.name }))} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 12, gap: 2 },
  action: { flex: 1, alignItems: 'center', gap: 8, padding: 12 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  pondIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' },
});
