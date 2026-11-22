// Alerts — designs: emergency_alert_response_center, advanced_sensor_threshold_alert_configuration.
import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, ChoiceChips, EmptyState, ErrorState, Header, LoadingList, Screen } from '@/components';
import { useAlerts, useDevices, useRealtime, useUpdateAlert } from '@/features/iot/api';
import { AlertRow } from '@/features/iot/AlertRow';

export default function Alerts() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const q = useAlerts(status);
  const devices = useDevices();
  const upd = useUpdateAlert();
  useRealtime('sensor_alerts', null, [['alerts']]);
  return (
    <Screen>
      <Header title={t('alerts.title')} right={<Button compact variant="text" iconLeft="settings" label={t('settings.notifications')} onPress={() => router.push('/settings/notifications')} />} />
      <ChoiceChips value={status} onChange={setStatus} options={[{ value: 'open', label: t('alerts.active') }, { value: 'all', label: t('alerts.all') }]} />
      {q.isLoading ? <LoadingList /> : q.error && !q.data ? <ErrorState onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <EmptyState icon="verified" title={t('alerts.none')} text={t('alerts.noneText')} />
      ) : (
        <Card style={{ gap: 4, paddingVertical: 6 }}>
          {q.data.map((a) => (
            <AlertRow key={a.id} alert={a} device={devices.data?.devices.find((d) => d.id === a.device_id)}
              onAck={a.status === 'open' ? () => upd.mutate({ id: a.id, status: 'acknowledged' }) : undefined} />
          ))}
        </Card>
      )}
    </Screen>
  );
}
