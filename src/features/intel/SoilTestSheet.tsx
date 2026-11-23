import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, ChoiceChips, DateField, Sheet, TextField } from '@/components';
import { today } from '@/lib/dates';
import type { SoilTest } from '@/types/database';
import { useAddSoilTest } from './api';

const FIELDS: { key: keyof SoilTest; label: string; unit: string; max: number }[] = [
  { key: 'ph', label: 'pH', unit: '', max: 14 }, { key: 'ec_dsm', label: 'EC', unit: 'dS/m', max: 50 }, { key: 'organic_carbon_pct', label: 'soil.oc', unit: '%', max: 100 },
  { key: 'nitrogen_kg_ha', label: 'soil.n', unit: 'kg/ha', max: 5000 }, { key: 'phosphorus_kg_ha', label: 'soil.p', unit: 'kg/ha', max: 5000 }, { key: 'potassium_kg_ha', label: 'soil.k', unit: 'kg/ha', max: 5000 },
  { key: 'sulphur_ppm', label: 'soil.s', unit: 'ppm', max: 5000 }, { key: 'zinc_ppm', label: 'soil.zn', unit: 'ppm', max: 500 },
];
export function SoilTestSheet({ visible, onClose, farmId }: { visible: boolean; onClose: () => void; farmId: string }) {
  const { t } = useTranslation();
  const add = useAddSoilTest();
  const [v, setV] = useState<Record<string, string>>({});
  const [date, setDate] = useState(today());
  const [source, setSource] = useState<SoilTest['source']>('soil_health_card');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (visible) { setV({}); setDate(today()); setError(null); } }, [visible]);
  const save = async () => {
    const row: Partial<SoilTest> = { farm_id: farmId, tested_on: date, source, lab_name: v.lab_name?.trim() || null };
    for (const f of FIELDS) {
      const s = (v[f.key] ?? '').trim();
      if (!s) continue;
      const n = Number(s.replace(',', '.'));
      if (!Number.isFinite(n) || n < 0 || n > f.max) { setError(t('soil.invalid', { field: t(f.label) })); return; }
      (row as Record<string, unknown>)[f.key] = n;
    }
    if (FIELDS.every((f) => row[f.key] == null)) { setError(t('soil.enterOne')); return; }
    try { await add.mutateAsync(row); onClose(); } catch { setError(t('errors.generic')); }
  };
  return (
    <Sheet visible={visible} onClose={onClose}>
      <AppText variant="headlineMd">{t('soil.addTest')}</AppText>
      <ChoiceChips value={source} onChange={setSource} options={(['soil_health_card', 'lab', 'field_kit'] as const).map((s) => ({ value: s, label: t(`soil.src.${s}`) }))} />
      <DateField label={t('soil.testedOn')} value={date} onChange={setDate} />
      <TextField label={t('soil.labName')} value={v.lab_name ?? ''} onChangeText={(x) => setV({ ...v, lab_name: x })} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FIELDS.map((f) => (
          <View key={f.key} style={{ flexBasis: '47%', flexGrow: 1 }}>
            <TextField label={`${t(f.label)}${f.unit ? ` (${f.unit})` : ''}`} keyboardType="decimal-pad" value={v[f.key] ?? ''} onChangeText={(x) => setV({ ...v, [f.key]: x })} />
          </View>
        ))}
      </View>
      {error && <Banner tone="error" message={error} />}
      <Button label={t('common.save')} iconLeft="check" loading={add.isPending} onPress={save} />
      <Button variant="text" label={t('common.cancel')} onPress={onClose} />
    </Sheet>
  );
}
