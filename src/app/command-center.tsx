// Farm command centre — design: smart_farm_command_center. One screen with the live state of the whole farm.
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Card, Header, Icon, IconName, Screen, SectionHeader, WeatherCard } from '@/components';
import { useDashboard } from '@/features/agriculture/api';
import { usePonds } from '@/features/aquaculture/api';
import { overall } from '@/features/aquaculture/waterQuality';
import { deviceStatus, useDevices, useEquipment, useRealtime } from '@/features/iot/api';
import { useVaccinations } from '@/features/livestock/api';
import { vaccState } from '@/features/livestock/vaccination';
import { useNotifications } from '@/features/notifications/api';
import { today } from '@/lib/dates';
import { colors, radius } from '@/theme';

export default function CommandCenter() {
  const { t } = useTranslation();
  const dash = useDashboard(); const iot = useDevices(); const eq = useEquipment(); const ponds = usePonds(); const vaccs = useVaccinations(); const notes = useNotifications();
  useRealtime('sensor_alerts', null, [['devices']]);
  useRealtime('device_channels', null, [['equipment']]);
  const devices = iot.data?.devices ?? [];
  const tiles: { icon: IconName; label: string; value: string; href: string; bad?: boolean }[] = [
    { icon: 'warning-amber', label: t('monitor.alerts'), value: String(iot.data?.alerts.length ?? 0), href: '/alerts-center', bad: !!iot.data?.alerts.length },
    { icon: 'sensors', label: t('monitor.online'), value: `${devices.filter((d) => deviceStatus(d) === 'online').length}/${devices.length}`, href: '/monitor/devices' },
    { icon: 'water-drop', label: t('fleet.running'), value: `${(eq.data ?? []).filter((c) => c.state === 'on').length}/${eq.data?.length ?? 0}`, href: '/monitor/equipment' },
    { icon: 'assignment-late', label: t('command.overdue'), value: String(dash.data?.overdue ?? 0), href: '/agriculture/calendar', bad: !!dash.data?.overdue },
    { icon: 'water', label: t('command.pondsRisk'), value: String((ponds.data ?? []).filter((p) => p.latest && overall(p.latest) === 'bad').length), href: '/aquaculture' },
    { icon: 'vaccines', label: t('command.vaccDue'), value: String((vaccs.data ?? []).filter((v) => ['overdue', 'due_soon'].includes(vaccState(v, today()))).length), href: '/livestock' },
    { icon: 'notifications', label: t('command.unread'), value: String((notes.data ?? []).filter((n) => !n.read_at).length), href: '/notifications' },
    { icon: 'eco', label: t('farms.cropsGrowing'), value: String(dash.data?.crops ?? 0), href: '/agriculture' },
  ];
  return (
    <Screen>
      <Header title={t('command.title')} />
      <WeatherCard />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tiles.map((x) => (
          <Pressable key={x.label} accessibilityRole="button" accessibilityLabel={`${x.label} ${x.value}`} onPress={() => router.push(x.href as never)}
            style={{ flexGrow: 1, flexBasis: '45%', padding: 12, gap: 4, borderRadius: radius.lg, backgroundColor: x.bad ? colors.errorSurface : colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Icon name={x.icon} color={x.bad ? colors.error : colors.primary} />
            <AppText variant="headlineMd">{x.value}</AppText>
            <AppText variant="labelMd" color={colors.textMuted}>{x.label}</AppText>
          </Pressable>
        ))}
      </View>
      <SectionHeader title={t('command.shortcuts')} />
      <Card style={{ gap: 4 }}>
        {([['monitor.title', '/monitor', 'sensors'], ['fleet.irrControlTitle', '/monitor/irrigation-control', 'water-drop'], ['insights.tiles.market', '/insights/market', 'storefront'], ['insights.tiles.finance', '/insights/finance', 'account-balance-wallet'], ['overview.title', '/overview', 'person']] as const).map(([k, href, icon]) => (
          <Pressable key={href} accessibilityRole="button" onPress={() => router.push(href as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 }}>
            <Icon name={icon} color={colors.primary} />
            <AppText variant="bodyLg" style={{ flex: 1 }}>{t(k)}</AppText>
            <Icon name="chevron-right" color={colors.textSubtle} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
