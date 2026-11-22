import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Checkbox, ChoiceChips, DateField, Sheet, TextField } from '@/components';
import { toErrorKey } from '@/features/auth/api';
import { today } from '@/lib/dates';
import { useCreateRecord } from './api';
import { ACTIVITIES, activitySchema, ActivityInput } from './schemas';

type Props = { visible: boolean; onClose: () => void; crops: { id: string; name: string }[]; cropId?: string; date?: string };

export function AddTaskSheet({ visible, onClose, crops, cropId, date }: Props) {
  const { t } = useTranslation();
  const create = useCreateRecord();
  const blank = (): ActivityInput => ({ crop_id: cropId ?? (crops.length === 1 ? crops[0].id : ''), activity: 'irrigation', scheduled_for: date ?? today(), notes: '', remind: true });
  const [v, setV] = useState<ActivityInput>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setV(blank()); setErrors({}); setError(null); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    const r = activitySchema.safeParse(v);
    if (!r.success) { setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    try {
      const cropName = crops.find((c) => c.id === v.crop_id)?.name ?? '';
      await create.mutateAsync({ input: r.data, cropName, title: t('calendar.reminderTitle'), body: t(`calendar.activities.${v.activity}`) });
      onClose();
    } catch (e) { setError(toErrorKey(e)); }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('calendar.add')}</AppText>
      {!cropId && (
        <ChoiceChips scroll label={t('calendar.crop')} value={v.crop_id || null} onChange={(crop_id) => setV({ ...v, crop_id })}
          error={errors.crop_id && t(errors.crop_id)} options={crops.map((c) => ({ value: c.id, label: c.name }))} />
      )}
      <ChoiceChips scroll label={t('calendar.activity')} value={v.activity} onChange={(activity) => setV({ ...v, activity })}
        options={ACTIVITIES.map((a) => ({ value: a, label: t(`calendar.activities.${a}`) }))} />
      <DateField label={t('calendar.date')} required value={v.scheduled_for} onChange={(scheduled_for) => setV({ ...v, scheduled_for })} error={errors.scheduled_for && t(errors.scheduled_for)} />
      <TextField label={t('calendar.notes')} value={v.notes} onChangeText={(notes) => setV({ ...v, notes })} error={errors.notes && t(errors.notes)} />
      <Checkbox checked={v.remind} onChange={(remind) => setV({ ...v, remind })} label={t('calendar.remind')}>
        <AppText variant="bodyMd">{t('calendar.remind')}</AppText>
      </Checkbox>
      {error && <Banner tone="error" message={t(error)} />}
      <View style={{ gap: 8 }}>
        <Button label={t('common.save')} iconLeft="check" loading={create.isPending} onPress={save} />
        <Button variant="text" label={t('common.cancel')} onPress={onClose} />
      </View>
    </Sheet>
  );
}
