// Application guidance & service centre — design: application_guidance_farmer_service_center.
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Checkbox, ChoiceChips, Header, LoadingList, Screen, SectionHeader } from '@/components';
import { useSchemes, useTrackScheme } from '@/features/intel/api';
import { SCHEME_DOCS } from '@/features/intel/schemes';
import { colors } from '@/theme';

export default function Apply() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ code?: string }>();
  const q = useSchemes(); const track = useTrackScheme();
  const [code, setCode] = useState<string | null>(params.code ?? null);
  const [have, setHave] = useState<Record<string, boolean>>({});
  if (q.isLoading) return <Screen><Header title={t('apply.title')} /><LoadingList /></Screen>;
  const s = q.data?.schemes.find((x) => x.code === code) ?? q.data?.schemes[0];
  if (!s) return <Screen><Header title={t('apply.title')} /><Banner message={t('errors.loadFailed')} /></Screen>;
  const docs = SCHEME_DOCS[s.code] ?? ['aadhaar', 'bank'];
  const tr = q.data!.tracking.find((x) => x.scheme_code === s.code);
  const ready = docs.every((d) => have[`${s.code}:${d}`]);
  return (
    <Screen>
      <Header title={t('apply.title')} />
      <ChoiceChips scroll value={s.code} onChange={setCode} options={q.data!.schemes.map((x) => ({ value: x.code, label: x.name[i18n.language] ?? x.name.en }))} />
      <AppText variant="headlineSm">{s.name[i18n.language] ?? s.name.en}</AppText>
      <SectionHeader title={t('apply.docs')} />
      <Card style={{ gap: 4 }}>
        {docs.map((d) => (
          <Checkbox key={d} checked={!!have[`${s.code}:${d}`]} label={t(`apply.doc.${d}`)} onChange={(v) => setHave({ ...have, [`${s.code}:${d}`]: v })}>
            <AppText variant="bodyMd" style={{ flex: 1 }}>{t(`apply.doc.${d}`)}</AppText>
          </Checkbox>
        ))}
        {ready && <AppText variant="labelLg" color={colors.secondary}>{t('apply.ready')}</AppText>}
      </Card>
      <SectionHeader title={t('apply.where')} />
      <Card style={{ gap: 6 }}>
        <AppText variant="bodyMd">{t(`apply.office.${s.code}`)}</AppText>
        <AppText variant="bodySm" color={colors.textMuted}>{t('apply.csc')}</AppText>
        <Button variant="secondary" iconLeft="open-in-new" label={t('schemes.official')} onPress={() => Linking.openURL(s.official_url)} />
      </Card>
      <ChoiceChips label={t('schemes.myStatus')} value={tr?.status ?? null} onChange={(status) => track.mutate({ code: s.code, status, existing: tr })} options={(['interested', 'applied', 'approved', 'rejected'] as const).map((x) => ({ value: x, label: t(`schemes.status.${x}`) }))} />
      <Banner message={t('apply.fraud')} />
    </Screen>
  );
}
