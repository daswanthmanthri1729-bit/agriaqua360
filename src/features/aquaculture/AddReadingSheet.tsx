import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, ChoiceChips, Sheet, TextField } from '@/components';
import { toErrorKey } from '@/features/auth/api';
import { useAddReading } from './api';
import { readingSchema, ReadingInput } from './schemas';
import { adviceKey, PARAMS, rangeLabel } from './waterQuality';

type Props = { visible: boolean; onClose: () => void; ponds: { id: string; name: string }[]; pondId?: string };

export function AddReadingSheet({ visible, onClose, ponds, pondId }: Props) {
  const { t } = useTranslation();
  const add = useAddReading();
  const blank = (): ReadingInput => ({ pond_id: pondId ?? (ponds.length === 1 ? ponds[0].id : ''), ph: '', dissolved_oxygen_mgl: '', temperature_c: '', ammonia_mgl: '', salinity_ppt: '', turbidity_cm: '', notes: '' });
  const [v, setV] = useState<ReadingInput>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setV(blank()); setErrors({}); setError(null); } }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live advice while typing, so the farmer acts before even saving.
  const advice = PARAMS.map((p) => (v[p.key] !== '' && !isNaN(Number(v[p.key])) ? adviceKey(p.key, Number(v[p.key])) : null)).filter(Boolean) as string[];

  const save = async () => {
    const r = readingSchema.safeParse(v);
    if (!r.success) { setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message]))); return; }
    try { await add.mutateAsync(r.data); onClose(); } catch (e) { setError(toErrorKey(e)); }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('water.add')}</AppText>
      <Banner message={t('water.meterNote')} />
      {!pondId && (
        <ChoiceChips scroll label={t('water.pond')} value={v.pond_id || null} onChange={(pond_id) => setV({ ...v, pond_id })}
          error={errors.pond_id && t(errors.pond_id)} options={ponds.map((p) => ({ value: p.id, label: p.name }))} />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {PARAMS.map((p) => (
          <View key={p.key} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <TextField testID={`wq-${p.key}`} label={p.unit === 'pH' ? t(`water.params.${p.key}`) : `${t(`water.params.${p.key}`)} (${p.unit})`} keyboardType="decimal-pad" value={v[p.key]}
              onChangeText={(x) => { setV({ ...v, [p.key]: x.replace(',', '.') }); setErrors({}); }} error={errors[p.key] && t(errors[p.key])}
              hint={rangeLabel(p.key) ? t('water.safe', { range: rangeLabel(p.key) }) : undefined} />
          </View>
        ))}
      </View>
      {advice.map((k) => <Banner key={k} tone="warning" message={t(k)} />)}
      <TextField label={t('water.notes')} value={v.notes} onChangeText={(notes) => setV({ ...v, notes })} error={errors.notes && t(errors.notes)} />
      {error && <Banner tone="error" message={t(error)} />}
      <Button testID="wq-save" label={t('water.save')} iconLeft="check" loading={add.isPending} onPress={save} />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}
