// 20 · Crop Treatment Recommendations — Stitch: visual_search_agriaqua_360 ("Recommended Next Steps")
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Checkbox, ChoiceChips, ErrorState, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { useAddTreatments, useScan } from '@/features/agriculture/api';
import { toErrorKey } from '@/features/auth/api';
import { addDays, today } from '@/lib/dates';
import { colors } from '@/theme';
import type { TreatmentType } from '@/types/database';

const GROUPS = ['cultural', 'organic', 'chemical', 'prevention'] as const;
const TYPE: Record<(typeof GROUPS)[number], TreatmentType> = { cultural: 'cultural', organic: 'organic', chemical: 'chemical', prevention: 'prevention' };

export default function Treatment() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scan = useScan(id);
  const add = useAddTreatments();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [days, setDays] = useState('7');
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'success' | 'error' | 'warning'; key: string } | null>(null);

  if (scan.isLoading) return <Screen><Header /><LoadingList /></Screen>;
  const report = scan.data?.report[0];
  const tr = report?.raw_response?.treatments;
  if (scan.error || !report || !tr) return <Screen><Header /><ErrorState onRetry={() => scan.refetch()} /></Screen>;

  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const saveSteps = async () => {
    if (!picked.size) { setMsg({ tone: 'warning', key: 'treatment.selectOne' }); return; }
    const items = [...picked].map((k) => { const [g, i] = k.split(':'); return { type: TYPE[g as (typeof GROUPS)[number]], text: tr[g as (typeof GROUPS)[number]][Number(i)] }; });
    try {
      await add.mutateAsync({
        reportId: report.id, cropId: scan.data!.crop?.id ?? null, items, followUp: addDays(today(), Number(days)),
        reminder: { title: t('treatment.reminderTitle'), body: t('treatment.reminderBody', { name: report.condition_name }) },
      });
      setMsg({ tone: 'success', key: 'treatment.added' });
      setSaved(true);
    } catch (e) { setMsg({ tone: 'error', key: toErrorKey(e) }); }
  };

  return (
    <Screen footer={<Button testID="save-treatment" label={t('treatment.add', { count: picked.size })} iconLeft="playlist-add-check" loading={add.isPending} disabled={saved} onPress={saveSteps} />}>
      <Header title={t('treatment.title')} />
      <AppText variant="headlineMd">{report.condition_name}</AppText>
      <AppText variant="bodyMd" color={colors.textMuted}>{t('treatment.intro')}</AppText>
      {GROUPS.map((g) => (
        <View key={g} style={{ gap: 8 }}>
          <SectionHeader title={t(`treatment.groups.${g}`)} />
          {g === 'chemical' && tr.chemical.length > 0 && <Banner tone="warning" message={t('treatment.chemicalWarning')} />}
          <Card style={{ paddingVertical: 4 }}>
            {tr[g].length ? tr[g].map((step, i) => {
              const k = `${g}:${i}`;
              return (
                <Checkbox key={k} checked={picked.has(k)} onChange={() => toggle(k)} label={step}>
                  <AppText variant="bodyMd" style={{ paddingVertical: 8 }}>{step}</AppText>
                </Checkbox>
              );
            }) : <AppText variant="bodyMd" color={colors.textMuted} style={{ paddingVertical: 10 }}>{t('treatment.none')}</AppText>}
          </Card>
        </View>
      ))}
      {report.recommend_expert && <Banner tone="error" title={t('result.expertTitle')} message={report.raw_response?.expert_reason || t('result.expertDefault')} />}
      <ChoiceChips label={t('treatment.followUp')} value={days} onChange={setDays}
        options={['3', '7', '14'].map((d) => ({ value: d, label: t('treatment.days', { count: Number(d) }) }))} />
      {msg && <Banner tone={msg.tone} message={t(msg.key)} onDismiss={() => setMsg(null)} />}
      {msg?.tone === 'success' && scan.data?.crop && (
        <Button variant="secondary" label={t('crops.details')} onPress={() => router.replace(`/agriculture/crops/${scan.data!.crop!.id}`)} />
      )}
    </Screen>
  );
}
