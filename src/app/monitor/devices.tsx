// Device management — design: unified_iot_device_management_dashboard.
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, Chip, ChoiceChips, EmptyState, ErrorState, Header, Icon, LoadingList, Screen, SourceBadge } from '@/components';
import { ago } from '@/components/Freshness';
import { deviceStatus, KIND_ICON, useDevices, useRealtime } from '@/features/iot/api';
import { colors } from '@/theme';
import type { DeviceKind } from '@/types/database';

const KINDS: (DeviceKind | 'all')[] = ['all', 'pond_node', 'field_node', 'collar', 'controller', 'gateway'];

export default function Devices() {
  const { t } = useTranslation();
  const q = useDevices();
  useRealtime('sensor_devices', null, [['devices']]);
  const [kind, setKind] = useState<DeviceKind | 'all'>('all');
  const [status, setStatus] = useState<'all' | 'online' | 'offline' | 'never'>('all');
  if (q.isLoading) return <Screen><Header title={t('fleet.devicesTitle')} /><LoadingList /></Screen>;
  if (q.error && !q.data) return <Screen><Header title={t('fleet.devicesTitle')} /><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const all = q.data?.devices ?? [];
  const list = all.filter((d) => (kind === 'all' || d.kind === kind) && (status === 'all' || deviceStatus(d) === status));
  return (
    <Screen footer={<Button iconLeft="add" label={t('monitor.addDevice')} onPress={() => router.push('/monitor/add')} />}>
      <Header title={t('fleet.devicesTitle')} />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {KINDS.slice(1).map((k) => { const n = all.filter((d) => d.kind === k).length; return n ? <Chip key={k} icon={KIND_ICON[k as DeviceKind]} label={`${t(`devices.kinds.${k}`)}: ${n}`} /> : null; })}
      </View>
      <ChoiceChips scroll value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: k === 'all' ? t('schemes.all') : t(`devices.kinds.${k}`) }))} />
      <ChoiceChips scroll value={status} onChange={setStatus} options={(['all', 'online', 'offline', 'never'] as const).map((s) => ({ value: s, label: s === 'all' ? t('schemes.all') : t(`monitor.status.${s}`) }))} />
      {!list.length ? <EmptyState icon="sensors" title={t('fleet.noMatch')} /> : list.map((d) => {
        const st = deviceStatus(d);
        const open = (q.data?.alerts ?? []).filter((a) => a.device_id === d.id).length;
        return (
          <Card key={d.id} onPress={() => router.push(`/monitor/device/${d.id}`)} accessibilityLabel={d.name} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name={KIND_ICON[d.kind]} color={colors.primaryDeep} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="labelLg" numberOfLines={1}>{d.name}</AppText>
              <AppText variant="bodySm" color={colors.textMuted}>{t(`devices.kinds.${d.kind}`)} · {d.transport.toUpperCase()} · {d.last_seen_at ? ago(d.last_seen_at, t) : t('monitor.neverSeen')}</AppText>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {d.is_simulated && <SourceBadge source="simulated" />}
                {open > 0 && <Chip tone="error" icon="warning-amber" label={t('fleet.alertsN', { count: open })} />}
                {d.firmware && <Chip tone="dark" label={d.firmware} />}
              </View>
            </View>
            <Chip tone={st === 'online' ? 'normal' : st === 'offline' ? 'warning' : 'dark'} label={t(`monitor.status.${st}`)} />
          </Card>
        );
      })}
    </Screen>
  );
}
