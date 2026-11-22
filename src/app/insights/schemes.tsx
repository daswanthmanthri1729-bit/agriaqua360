// Government schemes — designs: government_schemes_subsidy_discovery_dashboard, ai_scheme_eligibility_checker,
// subsidy_insurance_farm_support_intelligence, application_guidance_farmer_service_center.
// The eligibility hint is rule-based from the farmer's profile; the official site always decides.
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, ChoiceChips, ErrorState, Header, LoadingList, Screen } from '@/components';
import { useSchemes, useTrackScheme } from '@/features/intel/api';
import { eligibility } from '@/features/intel/schemes';
import { useCrops, useFarms } from '@/features/agriculture/api';
import { useAnimals } from '@/features/livestock/api';
import { useSession } from '@/store/session';
import { formatDate } from '@/lib/dates';
import { colors } from '@/theme';
import type { SchemeTracking } from '@/types/database';

const STATUSES = ['interested', 'applied', 'approved', 'rejected'] as const;

export default function Schemes() {
  const { t, i18n } = useTranslation();
  const q = useSchemes();
  const track = useTrackScheme();
  const profile = useSession((s) => s.profile);
  const farms = useFarms(); const crops = useCrops(); const animals = useAnimals();
  const [sector, setSector] = useState<string>('all');
  const lang = i18n.language;
  const ctx = {
    hasLand: (profile?.land_acres ?? 0) > 0 || !!farms.data?.length,
    hasCrop: !!crops.data?.some((c) => c.status !== 'harvested'),
    species: [...new Set((animals.data ?? []).map((a) => a.species))],
    sectors: profile?.sectors ?? ['agriculture'],
  };

  if (q.isLoading) return <Screen><Header title={t('schemes.title')} /><LoadingList /></Screen>;
  if (!q.data) return <Screen><Header title={t('schemes.title')} /><ErrorState onRetry={() => q.refetch()} /></Screen>;
  const list = q.data.schemes.filter((s) => sector === 'all' || s.sectors.includes(sector))
    .map((s) => ({ s, e: eligibility(s, ctx), tr: q.data.tracking.find((x) => x.scheme_code === s.code) }))
    .sort((a, b) => Number(b.e.level === 'likely') - Number(a.e.level === 'likely'));

  return (
    <Screen>
      <Header title={t('schemes.title')} />
      <Banner message={t('schemes.disclaimer')} />
      <ChoiceChips scroll value={sector} onChange={setSector} options={['all', 'agriculture', 'aquaculture', 'livestock'].map((x) => ({ value: x, label: t(x === 'all' ? 'schemes.all' : `sectors.${x}`) }))} />
      {list.map(({ s, e, tr }) => (
        <Card key={s.code} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip tone={e.level === 'likely' ? 'normal' : 'warning'} icon={e.level === 'likely' ? 'verified' : 'help-outline'} label={t(`schemes.${e.level}`)} />
            <Chip tone="dark" label={t(`schemes.level.${s.level}`)} />
            {tr && <Chip tone="ai" label={t(`schemes.status.${tr.status}`)} />}
          </View>
          <AppText variant="headlineSm">{s.name[lang] ?? s.name.en}</AppText>
          <AppText variant="bodyMd">{s.summary[lang] ?? s.summary.en}</AppText>
          <AppText variant="bodySm" color={colors.textMuted}>{t(e.reason)}</AppText>
          <AppText variant="labelSm" color={colors.textSubtle}>{t('schemes.asOf', { date: formatDate(s.info_as_of, lang) })}</AppText>
          <Button variant="secondary" iconLeft="open-in-new" label={t('schemes.official')} onPress={() => Linking.openURL(s.official_url)} />
          <TrackChips code={s.code} tr={tr} onSet={(status) => track.mutate({ code: s.code, status, existing: tr })} />
        </Card>
      ))}
      <AppText variant="bodySm" color={colors.textMuted}>{t('schemes.stateNote')}</AppText>
    </Screen>
  );
}

function TrackChips({ tr, onSet }: { code: string; tr?: SchemeTracking; onSet: (s: SchemeTracking['status'] | null) => void }) {
  const { t } = useTranslation();
  return (
    <ChoiceChips scroll label={t('schemes.myStatus')} value={tr?.status ?? null} onChange={(v) => onSet(v === tr?.status ? null : v)}
      options={STATUSES.map((x) => ({ value: x, label: t(`schemes.status.${x}`) }))} />
  );
}
