// Insurance & farm support — design: subsidy_insurance_farm_support_intelligence.
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Chip, Header, Icon, LoadingList, Screen, SectionHeader } from '@/components';
import { useCrops } from '@/features/agriculture/api';
import { useSchemes, useTrackScheme } from '@/features/intel/api';
import { colors } from '@/theme';

const SUPPORT = ['pmfby', 'kcc', 'nlm', 'aif'];

export default function Insurance() {
  const { t, i18n } = useTranslation();
  const q = useSchemes(); const crops = useCrops(); const track = useTrackScheme();
  if (q.isLoading) return <Screen><Header title={t('insure.title')} /><LoadingList /></Screen>;
  const growing = (crops.data ?? []).filter((c) => c.status === 'growing' || c.status === 'planned');
  const pmfby = q.data?.tracking.find((x) => x.scheme_code === 'pmfby');
  return (
    <Screen>
      <Header title={t('insure.title')} />
      {growing.length > 0 && !pmfby && <Banner tone="warning" title={t('insure.uninsuredTitle')} message={t('insure.uninsured', { crops: growing.map((c) => c.name).join(', ') })} />}
      <Card style={{ gap: 8, backgroundColor: colors.errorSurface }}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><Icon name="report" color={colors.error} /><AppText variant="labelLg">{t('insure.lossTitle')}</AppText></View>
        <AppText variant="bodyMd">{t('insure.lossSteps')}</AppText>
        <Button compact variant="secondary" iconLeft="call" label={t('insure.helpline')} onPress={() => Linking.openURL('tel:14447')} />
      </Card>
      <SectionHeader title={t('insure.options')} />
      {(q.data?.schemes ?? []).filter((s) => SUPPORT.includes(s.code)).map((s) => {
        const tr = q.data!.tracking.find((x) => x.scheme_code === s.code);
        return (
          <Card key={s.code} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <AppText variant="labelLg" style={{ flex: 1 }}>{s.name[i18n.language] ?? s.name.en}</AppText>
              {tr && <Chip tone="ai" label={t(`schemes.status.${tr.status}`)} />}
            </View>
            <AppText variant="bodySm" color={colors.textMuted}>{s.summary[i18n.language] ?? s.summary.en}</AppText>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {!tr && <Button compact variant="secondary" iconLeft="bookmark-add" label={t('schemes.status.interested')} onPress={() => track.mutate({ code: s.code, status: 'interested' })} />}
              <Button compact variant="text" iconLeft="description" label={t('apply.howTo')} onPress={() => router.push({ pathname: '/insights/apply', params: { code: s.code } })} />
            </View>
          </Card>
        );
      })}
      <AppText variant="bodySm" color={colors.textSubtle}>{t('schemes.disclaimer')}</AppText>
    </Screen>
  );
}
