// Personal farmer overview — design: personalized_farmer_intelligence_platform_overview.
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, Chip, Header, Icon, IconName, Screen, SectionHeader, StorageImage } from '@/components';
import { useReport } from '@/features/reports/api';
import { useDevices } from '@/features/iot/api';
import { useSession } from '@/store/session';
import { colors, radius } from '@/theme';

const PATHS: Record<string, { icon: IconName; label: string; href: string }[]> = {
  agriculture: [{ icon: 'eco', label: 'growth.title', href: '/agriculture/growth' }, { icon: 'water-drop', label: 'irrigation.title', href: '/agriculture/irrigation' }, { icon: 'layers', label: 'soil.title', href: '/agriculture/soil' }, { icon: 'storefront', label: 'market.title', href: '/insights/market' }],
  aquaculture: [{ icon: 'water', label: 'aquaX.analyticsTitle', href: '/aquaculture/water-analytics' }, { icon: 'set-meal', label: 'aquaX.feedingTitle', href: '/aquaculture/feeding' }, { icon: 'trending-up', label: 'aquaX.predTitle', href: '/aquaculture/predictions' }],
  livestock: [{ icon: 'monitor-heart', label: 'herd.healthTitle', href: '/livestock/health-ai' }, { icon: 'water-drop', label: 'herd.prodTitle', href: '/livestock/productivity' }, { icon: 'grass', label: 'herd.nutritionTitle', href: '/livestock/nutrition' }],
};

export default function Overview() {
  const { t } = useTranslation();
  const profile = useSession((s) => s.profile);
  const r = useReport(30); const iot = useDevices();
  const sectors = profile?.sectors?.length ? profile.sectors : ['agriculture'];
  return (
    <Screen>
      <Header title={t('overview.title')} />
      <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <StorageImage path={profile?.avatar_path} bucket="avatars" fallback="person" style={{ width: 56, height: 56, borderRadius: 28 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="headlineSm">{profile?.full_name ?? t('dashboard.farmer')}</AppText>
          <AppText variant="bodySm" color={colors.textMuted}>{[profile?.village, profile?.district, profile?.state].filter(Boolean).join(', ')}</AppText>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{sectors.map((s) => <Chip key={s} label={t(`sectors.${s}`)} />)}</View>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[[t('farms.registered'), r.data?.agriculture.farms], [t('common.acres'), r.data?.agriculture.acres], [t('aqua.pondsCount', { count: r.data?.aquaculture.ponds ?? 0 })], [t('livestock.animalsCount', { count: r.data?.livestock.animals ?? 0 })], [t('monitor.devices'), iot.data?.devices.length]].map(([l, v]) => (
          <View key={l as string} style={{ flexGrow: 1, flexBasis: '30%', padding: 12, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            {v !== undefined && <AppText variant="headlineSm">{String(v ?? 0)}</AppText>}
            <AppText variant="labelMd" color={colors.textMuted}>{l as string}</AppText>
          </View>
        ))}
      </View>
      {sectors.map((s) => (
        <View key={s} style={{ gap: 8 }}>
          <SectionHeader title={t('overview.forYou', { sector: t(`sectors.${s}`) })} />
          <Card style={{ gap: 2, paddingVertical: 6 }}>
            {(PATHS[s] ?? []).map((p) => (
              <Pressable key={p.href} accessibilityRole="button" onPress={() => router.push(p.href as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
                <Icon name={p.icon} color={colors.primary} />
                <AppText variant="bodyLg" style={{ flex: 1 }}>{t(p.label)}</AppText>
                <Icon name="chevron-right" color={colors.textSubtle} />
              </Pressable>
            ))}
          </Card>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={() => router.push('/profile')}><AppText variant="labelLg" color={colors.primary}>{t('overview.editProfile')}</AppText></Pressable>
    </Screen>
  );
}
