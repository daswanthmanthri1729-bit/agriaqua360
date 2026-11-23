// One pump / aerator / valve / feeder: state, manual override, start (with confirmation) and stop, pending command.
import { Alert, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, Icon } from '@/components';
import { ago } from '@/components/Freshness';
import { colors } from '@/theme';
import type { ActuatorCommand, DeviceChannel } from '@/types/database';
import { useCancelCommand, useSendCommand } from './api';

export function EquipmentCard({ channel: c, commands, subtitle }: { channel: DeviceChannel; commands: ActuatorCommand[]; subtitle?: string }) {
  const { t } = useTranslation();
  const send = useSendCommand();
  const cancel = useCancelCommand();
  const pending = commands.find((x) => x.device_id === c.device_id && x.channel === c.channel && (x.status === 'pending' || x.status === 'sent'));
  const options = [5, 15, 30, 60].filter((m) => m * 60 <= (c.max_run_s ?? 0));
  const run = (minutes: number | null) => {
    const label = c.label ?? c.channel;
    Alert.alert(minutes ? t('equipment.confirmOn', { name: label, minutes }) : t('equipment.confirmOff', { name: label }), t('equipment.confirmText'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: minutes ? t('equipment.start') : t('equipment.stop'), style: minutes ? 'default' : 'destructive', onPress: () =>
        send.mutate({ device_id: c.device_id, channel: c.channel, action: minutes ? 'on' : 'off', duration_s: minutes ? minutes * 60 : null }, { onError: () => Alert.alert(t('errors.generic')) }) },
    ]);
  };
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.state === 'on' ? colors.secondary : colors.outline }} />
        <View style={{ flex: 1 }}>
          <AppText variant="labelLg">{c.label ?? c.channel}</AppText>
          <AppText variant="bodySm" color={colors.textMuted}>{subtitle ? `${subtitle} · ` : ''}{t(`equipment.state.${c.state ?? 'unknown'}`)}{c.state_at ? ` · ${ago(c.state_at, t)}` : ''} · {t('equipment.maxRunShort', { minutes: Math.round((c.max_run_s ?? 0) / 60) })}</AppText>
        </View>
        {c.manual_override && <Chip tone="warning" icon="pan-tool" label={t('equipment.manual')} />}
      </View>
      {c.manual_override ? <Banner tone="warning" message={t('equipment.manualText')} /> : pending ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="hourglass-top" color={colors.warning} />
          <AppText variant="bodyMd" style={{ flex: 1 }}>{t(`equipment.cmdStatus.${pending.status}`, { action: t(`equipment.${pending.action === 'on' ? 'start' : 'stop'}`) })}</AppText>
          {pending.status === 'pending' && <Button compact variant="text" label={t('common.cancel')} onPress={() => cancel.mutate(pending.id)} />}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {options.map((m) => <Button key={m} compact variant="secondary" iconLeft="play-arrow" label={t('equipment.minutes', { count: m })} onPress={() => run(m)} />)}
          <Button compact variant="text" iconLeft="stop" label={t('equipment.stop')} onPress={() => run(null)} />
        </View>
      )}
    </Card>
  );
}
