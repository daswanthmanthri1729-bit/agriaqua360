// Farm automation dashboard — design: smart_farm_automation_dashboard.
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, EmptyState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { ago } from '@/components/Freshness';
import { useCommands, useEquipment, useRealtime, useRules } from '@/features/iot/api';
import { EquipmentCard } from '@/features/iot/EquipmentCard';
import { colors } from '@/theme';

export default function EquipmentHub() {
  const { t } = useTranslation();
  const eq = useEquipment(); const rules = useRules(); const cmds = useCommands();
  useRealtime('device_channels', null, [['equipment']]);
  useRealtime('actuator_commands', null, [['commands', 'all']]);
  if (eq.isLoading) return <Screen><Header title={t('monitor.equipment')} /><LoadingList /></Screen>;
  if (!eq.data?.length) return <Screen><Header title={t('monitor.equipment')} /><EmptyState icon="settings-remote" title={t('rules.needController')} text={t('fleet.controllerText')} action={t('monitor.addDevice')} onAction={() => router.push('/monitor/add')} /></Screen>;
  const running = eq.data.filter((c) => c.state === 'on').length;
  const active = (rules.data ?? []).filter((r) => r.enabled).length;
  return (
    <Screen>
      <Header title={t('monitor.equipment')} />
      <Card style={{ flexDirection: 'row', gap: 8 }}>
        {[[t('fleet.running'), `${running}/${eq.data.length}`], [t('fleet.rulesOn'), `${active}/${rules.data?.length ?? 0}`], [t('fleet.cmdsToday'), String((cmds.data ?? []).filter((c) => c.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length)]].map(([l, v]) => (
          <View key={l} style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="labelSm" color={colors.textSubtle} align="center">{l}</AppText>
            <AppText variant="headlineSm">{v}</AppText>
          </View>
        ))}
      </Card>
      {eq.data.map((c) => <EquipmentCard key={c.id} channel={c} commands={cmds.data ?? []} subtitle={c.device?.name} />)}
      <Button variant="secondary" iconLeft="rule" label={t('monitor.automation')} onPress={() => router.push('/monitor/automation')} />
      <SectionHeader title={t('equipment.log')} />
      <Card style={{ gap: 6 }}>
        {(cmds.data ?? []).slice(0, 15).map((x) => (
          <AppText key={x.id} variant="bodySm" color={colors.textMuted}>
            {ago(x.created_at, t)} · {eq.data!.find((c) => c.device_id === x.device_id && c.channel === x.channel)?.label ?? x.channel} · {t(`equipment.${x.action === 'on' ? 'start' : 'stop'}`)}{x.duration_s ? ` ${Math.round(x.duration_s / 60)} min` : ''} · {x.requested_by === 'rule' ? t('equipment.byRule') : t('equipment.byYou')} · {t(`equipment.status.${x.status}`)}
          </AppText>
        ))}
        {!cmds.data?.length && <AppText variant="bodySm" color={colors.textMuted}>{t('fleet.noCommands')}</AppText>}
      </Card>
    </Screen>
  );
}
