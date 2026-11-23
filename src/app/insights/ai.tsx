// AI farm intelligence — design: ai_farm_intelligence. Every AI check in one place, each run on demand.
import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, ChoiceChips, Header, Screen, SectionHeader } from '@/components';
import { useCrops, useFarms } from '@/features/agriculture/api';
import { usePonds } from '@/features/aquaculture/api';
import { InsightCard } from '@/features/intel/InsightCard';
import { useAnimals } from '@/features/livestock/api';
import { colors } from '@/theme';

export default function AiFarm() {
  const { t } = useTranslation();
  const farms = useFarms(); const crops = useCrops(); const ponds = usePonds(); const animals = useAnimals();
  const [crop, setCrop] = useState<string | null>(null);
  const [pond, setPond] = useState<string | null>(null);
  const [animal, setAnimal] = useState<string | null>(null);
  const growing = (crops.data ?? []).filter((c) => c.status === 'growing');
  const c = crop ?? growing[0]?.id ?? null, p = pond ?? ponds.data?.[0]?.id ?? null, a = animal ?? animals.data?.[0]?.id ?? null;
  return (
    <Screen>
      <Header title={t('aiFarm.title')} />
      <AppText variant="bodyMd" color={colors.textMuted}>{t('aiInsight.intro')}</AppText>
      {!!growing.length && (<><SectionHeader title={t('aiInsight.title.crop')} />
        {growing.length > 1 && <ChoiceChips scroll value={c} onChange={setCrop} options={growing.map((x) => ({ value: x.id, label: x.name }))} />}
        <InsightCard key={c} kind="crop" id={c} /></>)}
      {!!ponds.data?.length && (<><SectionHeader title={t('aiInsight.title.water')} />
        {ponds.data.length > 1 && <ChoiceChips scroll value={p} onChange={setPond} options={ponds.data.map((x) => ({ value: x.id, label: x.name }))} />}
        <InsightCard key={p} kind="water" id={p} /></>)}
      {!!animals.data?.length && (<><SectionHeader title={t('aiInsight.title.livestock')} />
        {animals.data.length > 1 && <ChoiceChips scroll value={a} onChange={setAnimal} options={animals.data.map((x) => ({ value: x.id, label: x.name ?? x.tag_id ?? x.species }))} />}
        <InsightCard key={a} kind="livestock" id={a} /></>)}
      {!!farms.data?.length && (<><SectionHeader title={t('aiInsight.title.soil')} /><InsightCard kind="soil" id={farms.data[0].id} /></>)}
      <SectionHeader title={t('aiInsight.title.finance')} />
      <InsightCard kind="finance" id={null} />
      <Button variant="ai" iconLeft="chat" label={t('aiFarm.askSahayak')} onPress={() => router.push('/assistant')} />
    </Screen>
  );
}
