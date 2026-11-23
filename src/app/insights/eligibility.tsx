// Scheme eligibility checker — design: ai_scheme_eligibility_checker. Short questionnaire → result per scheme with reason.
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Checkbox, Chip, ChoiceChips, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { useSchemes } from '@/features/intel/api';
import { Answers, checkEligibility } from '@/features/intel/schemes';
import { useAnimals } from '@/features/livestock/api';
import { useSession } from '@/store/session';
import { colors } from '@/theme';

export default function Eligibility() {
  const { t, i18n } = useTranslation();
  const profile = useSession((s) => s.profile);
  const animals = useAnimals();
  const q = useSchemes();
  const [a, setA] = useState<Answers>({ land: (profile?.land_acres ?? 0) > 0 ? 'own' : 'none', crop: true, sectors: profile?.sectors ?? ['agriculture'], species: [], category: 'general', taxPayer: false, govtEmployee: false });
  const [done, setDone] = useState(false);
  if (q.isLoading) return <Screen><Header title={t('elig.title')} /><LoadingList /></Screen>;
  const answers = { ...a, species: [...new Set((animals.data ?? []).map((x) => x.species))] };
  const results = (q.data?.schemes ?? []).map((s) => ({ s, r: checkEligibility(s.code, answers) })).sort((x, y) => ['likely', 'check', 'no'].indexOf(x.r.result) - ['likely', 'check', 'no'].indexOf(y.r.result));
  return (
    <Screen footer={!done ? <Button iconLeft="fact-check" label={t('elig.check')} onPress={() => setDone(true)} /> : undefined}>
      <Header title={t('elig.title')} />
      {!done ? (
        <>
          <ChoiceChips label={t('elig.qLand')} value={a.land} onChange={(land) => setA({ ...a, land })} options={(['own', 'tenant', 'none'] as const).map((v) => ({ value: v, label: t(`elig.land.${v}`) }))} />
          <ChoiceChips label={t('elig.qCategory')} value={a.category} onChange={(category) => setA({ ...a, category })} options={(['general', 'sc_st', 'woman'] as const).map((v) => ({ value: v, label: t(`elig.cat.${v}`) }))} />
          <SectionHeader title={t('elig.qSectors')} />
          {['agriculture', 'aquaculture', 'livestock'].map((s) => (
            <Checkbox key={s} checked={a.sectors.includes(s)} label={t(`sectors.${s}`)} onChange={(on) => setA({ ...a, sectors: on ? [...a.sectors, s] : a.sectors.filter((x) => x !== s) })}>
              <AppText variant="bodyLg">{t(`sectors.${s}`)}</AppText>
            </Checkbox>
          ))}
          {[['crop', 'elig.qCrop'], ['taxPayer', 'elig.qTax'], ['govtEmployee', 'elig.qGovt']].map(([k, label]) => (
            <Checkbox key={k} checked={a[k as 'crop']} label={t(label)} onChange={(v) => setA({ ...a, [k]: v })}>
              <AppText variant="bodyLg" style={{ flex: 1 }}>{t(label)}</AppText>
            </Checkbox>
          ))}
          <Banner message={t('elig.private')} />
        </>
      ) : (
        <>
          <Banner message={t('schemes.disclaimer')} />
          {results.map(({ s, r }) => (
            <Card key={s.code} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <AppText variant="labelLg" style={{ flex: 1 }}>{s.name[i18n.language] ?? s.name.en}</AppText>
                <Chip tone={r.result === 'likely' ? 'normal' : r.result === 'no' ? 'error' : 'warning'} label={t(`elig.res.${r.result}`)} />
              </View>
              <AppText variant="bodySm" color={colors.textMuted}>{t(r.reason)}</AppText>
              {r.result !== 'no' && (
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  <Button compact variant="secondary" iconLeft="description" label={t('apply.howTo')} onPress={() => router.push({ pathname: '/insights/apply', params: { code: s.code } })} />
                  <Button compact variant="text" iconLeft="open-in-new" label={t('schemes.official')} onPress={() => Linking.openURL(s.official_url)} />
                </View>
              )}
            </Card>
          ))}
          <Button variant="text" iconLeft="edit" label={t('elig.change')} onPress={() => setDone(false)} />
        </>
      )}
    </Screen>
  );
}
