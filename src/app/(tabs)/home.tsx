// 09 · Main Dashboard — Stitch: 06_home_dashboard_screen
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppText, Banner, Button, Card, Chip, EmptyState, ErrorState, Icon, IconName, LanguagePills, SectionHeader, Skeleton, StorageImage, WeatherCard,
} from '@/components';
import { ACTIVITY_ICON, useDashboard } from '@/features/agriculture/api';
import { useNotifications } from '@/features/notifications/api';
import { usePonds } from '@/features/aquaculture/api';
import { overall } from '@/features/aquaculture/waterQuality';
import { useAnimals, useVaccinations } from '@/features/livestock/api';
import { vaccState } from '@/features/livestock/vaccination';
import { useWeather, useWeatherTarget } from '@/features/weather/api';
import { formatDate, today } from '@/lib/dates';
import { useSession } from '@/store/session';
import { queryClient } from '@/lib/query';
import { colors, radius, space } from '@/theme';

const ACTIONS: { key: string; icon: IconName; href: string }[] = [
  { key: 'addFarm', icon: 'add-location-alt', href: '/agriculture/farms/new' },
  { key: 'addCrop', icon: 'eco', href: '/agriculture/crops/new' },
  { key: 'scanCrop', icon: 'document-scanner', href: '/agriculture/scan' },
  { key: 'calendar', icon: 'event-note', href: '/agriculture/calendar' },
  { key: 'weather', icon: 'wb-cloudy', href: '/agriculture/weather' },
  { key: 'livestock', icon: 'pets', href: '/livestock' },
];

function greetingKey() {
  const h = new Date().getHours();
  return h < 12 ? 'dashboard.morning' : h < 17 ? 'dashboard.afternoon' : 'dashboard.evening';
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const profile = useSession((s) => s.profile);
  const dash = useDashboard();
  const ponds = usePonds();
  const unread = (useNotifications().data ?? []).filter((n) => !n.read_at).length;
  const showAqua = !!ponds.data?.length || !!profile?.sectors?.includes('aquaculture');
  const animals = useAnimals();
  const vaccs = useVaccinations();
  const showLive = !!animals.data?.length || !!profile?.sectors?.includes('livestock');
  const herd = (animals.data ?? []).filter((a) => a.status !== 'sold' && a.status !== 'deceased').length;
  const vaccDue = (vaccs.data ?? []).filter((v) => ['overdue', 'due_soon'].includes(vaccState(v, today()))).length;
  const pondAlerts = (ponds.data ?? []).filter((p) => p.latest && overall(p.latest) === 'bad').length;
  const weather = useWeather(useWeatherTarget());
  const advisory = weather.data?.advisories[0];
  const refresh = () => queryClient.invalidateQueries();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={dash.isRefetching} onRefresh={refresh} colors={[colors.primary]} />}>
        <View style={styles.header}>
          <StorageImage path={profile?.avatar_path} bucket="avatars" fallback="person" style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <AppText variant="labelMd" color={colors.textSubtle}>{t(greetingKey()).toUpperCase()}</AppText>
            <AppText variant="headlineMd" numberOfLines={1}>{profile?.full_name ?? t('dashboard.farmer')}</AppText>
          </View>
          <Pressable testID="bell" accessibilityRole="button" accessibilityLabel={`${t('notifications.title')}${unread ? `, ${unread} ${t('notifications.new')}` : ''}`} hitSlop={8} style={styles.iconBtn}
            onPress={() => router.push('/notifications')}>
            <Icon name={unread ? 'notifications-active' : 'notifications-none'} color={colors.primaryDeep} />
            {unread > 0 && <View style={styles.badge}><AppText variant="labelSm" color={colors.white}>{unread > 9 ? '9+' : unread}</AppText></View>}
          </Pressable>
        </View>
        <View style={{ alignSelf: 'flex-start' }}><LanguagePills /></View>

        <WeatherCard />

        <SectionHeader title={t('dashboard.quickActions')} />
        <ScrollView horizontal style={{ flexGrow: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {ACTIONS.map((a) => (
            <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={t(`dashboard.${a.key}`)} onPress={() => router.push(a.href as never)}
              style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceLow }]}>
              <View style={styles.actionIcon}><Icon name={a.icon} size={26} color={colors.primaryDeep} /></View>
              <AppText variant="labelMd" align="center" numberOfLines={2}>{t(`dashboard.${a.key}`)}</AppText>
            </Pressable>
          ))}
        </ScrollView>

        <SectionHeader title={t('dashboard.updates')} />
        {advisory && (
          <Banner tone="warning" title={`${t('weather.advisories')} · ${formatDate(advisory.date, i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })}`}
            message={t(`weather.adv.${advisory.kind}`, { value: advisory.value })} />
        )}
        {!!dash.data?.overdue && (
          <Card onPress={() => router.push('/agriculture/calendar')} style={styles.row} accessibilityLabel={t('dashboard.overdue', { count: dash.data.overdue })}>
            <Icon name="assignment-late" color={colors.error} />
            <AppText variant="labelLg" style={{ flex: 1 }}>{t('dashboard.overdue', { count: dash.data.overdue })}</AppText>
            <AppText variant="labelLg" color={colors.primary}>{t('dashboard.overdueAction')}</AppText>
          </Card>
        )}
        {!advisory && dash.data && !dash.data.overdue && <Banner tone="success" message={t('dashboard.noUpdates')} />}

        <SectionHeader title={t('dashboard.upcoming')} action={t('common.seeAll')} onAction={() => router.push('/agriculture/calendar')} />
        {dash.isLoading ? <Skeleton height={120} /> : dash.error ? <ErrorState onRetry={() => dash.refetch()} /> : dash.data!.upcoming.length === 0 ? (
          <AppText variant="bodyMd" color={colors.textMuted}>{t('dashboard.noUpcoming')}</AppText>
        ) : (
          <Card style={{ gap: 4, paddingVertical: 8 }}>
            {dash.data!.upcoming.map((r) => (
              <Pressable key={r.id} accessibilityRole="button" onPress={() => r.crop && router.push(`/agriculture/crops/${r.crop.id}`)} style={styles.task}>
                <View style={styles.taskIcon}><Icon name={ACTIVITY_ICON[r.activity] as IconName} size={20} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <AppText variant="labelLg">{t(`calendar.activities.${r.activity}`)} · {r.crop?.name}</AppText>
                  <AppText variant="bodySm" color={colors.textMuted}>
                    {r.scheduled_for === today() ? t('calendar.today') : formatDate(r.scheduled_for!, i18n.language, { weekday: 'long', day: 'numeric', month: 'short' })}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </Card>
        )}

        <SectionHeader title={t('dashboard.yourWorld')} />
        {dash.data && dash.data.farms === 0 ? (
          <EmptyState icon="add-location-alt" title={t('dashboard.startTitle')} text={t('dashboard.startText')} action={t('dashboard.addFarm')} onAction={() => router.push('/agriculture/farms/new')} />
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <View style={styles.sectorImg}>
              <Image source={require('../../../assets/images/hero-farm.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.sectorShade}>
                <AppText variant="labelMd" color={colors.lime}>{t('dashboard.agriTitle').toUpperCase()}</AppText>
                <AppText variant="headlineMd" color={colors.white}>{t('dashboard.farmsCount', { count: dash.data?.farms ?? 0 })}</AppText>
              </View>
            </View>
            <View style={{ padding: space.md, gap: 12 }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Chip icon="eco" label={t('dashboard.cropsGrowing', { count: dash.data?.crops ?? 0 })} />
                <AppText variant="labelLg">{(dash.data?.acres ?? 0).toLocaleString()} {t('common.acres')}</AppText>
              </View>
              <Button label={t('dashboard.exploreAgri')} icon="arrow-forward" onPress={() => router.push('/agriculture')} />
            </View>
          </Card>
        )}
        {showAqua && (
          <Card style={{ gap: 12 }}>
            <View style={styles.row}>
              <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}><Icon name="water" size={26} color={colors.water} /></View>
              <View style={{ flex: 1 }}>
                <AppText variant="labelMd" color={colors.textSubtle}>{t('aqua.aquaTitle').toUpperCase()}</AppText>
                <AppText variant="headlineSm">{t('aqua.pondsCount', { count: ponds.data?.length ?? 0 })}</AppText>
              </View>
              {pondAlerts > 0 && <Chip tone="error" icon="warning-amber" label={`${pondAlerts}`} />}
            </View>
            <Button variant="secondary" label={t('aqua.exploreAqua')} icon="arrow-forward" onPress={() => router.push('/aquaculture')} />
          </Card>
        )}
        {showLive && (
          <Card style={{ gap: 12 }}>
            <View style={styles.row}>
              <View style={styles.actionIcon}><Icon name="pets" size={26} color={colors.primaryDeep} /></View>
              <View style={{ flex: 1 }}>
                <AppText variant="labelMd" color={colors.textSubtle}>{t('livestock.livestockTitle').toUpperCase()}</AppText>
                <AppText variant="headlineSm">{t('livestock.animalsCount', { count: herd })}</AppText>
              </View>
              {vaccDue > 0 && <Chip tone="warning" icon="vaccines" label={`${vaccDue}`} />}
            </View>
            <Button variant="secondary" label={t('livestock.exploreLivestock')} icon="arrow-forward" onPress={() => router.push('/livestock')} />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  action: { width: 88, minHeight: 100, padding: 8, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: 8 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  taskIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  sectorImg: { height: 150, justifyContent: 'flex-end' },
  sectorShade: { padding: space.md, backgroundColor: 'rgba(0,0,0,0.35)' },
});
