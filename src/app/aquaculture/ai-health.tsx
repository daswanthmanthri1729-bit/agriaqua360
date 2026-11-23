// AI fish-health assistant — design: ai_aquaculture_assistant_fish_health.
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Button, Card, EmptyState, Header, Icon, LoadingList, Screen, SectionHeader } from '@/components';
import { usePondPick } from '@/features/aquaculture/usePondPick';
import { InsightCard } from '@/features/intel/InsightCard';
import { colors } from '@/theme';

const QUESTIONS = ['gasping', 'notEating', 'redSpots', 'whiteFeces', 'greenWater'] as const;

export default function AiFishHealth() {
  const { t } = useTranslation();
  const { loading, pond, picker } = usePondPick();
  if (loading) return <Screen><Header title={t('aquaX.aiTitle')} /><LoadingList /></Screen>;
  if (!pond) return <Screen><Header title={t('aquaX.aiTitle')} /><EmptyState icon="water" title={t('aquaX.noPond')} action={t('aquaX.addPond')} onAction={() => router.push('/aquaculture/ponds')} /></Screen>;
  return (
    <Screen>
      <Header title={t('aquaX.aiTitle')} />
      {picker}
      <InsightCard kind="water" id={pond.id} />
      <SectionHeader title={t('aquaX.askAbout')} />
      <Card style={{ gap: 4, paddingVertical: 6 }}>
        {QUESTIONS.map((k) => (
          <Pressable key={k} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 }}
            onPress={() => router.push({ pathname: '/assistant', params: { q: t(`aquaX.q.${k}`, { pond: pond.name, species: pond.species ?? '' }) } })}>
            <Icon name="help-outline" color={colors.ai} />
            <AppText variant="bodyMd" style={{ flex: 1 }}>{t(`aquaX.q.${k}`, { pond: pond.name, species: pond.species ?? '' })}</AppText>
            <Icon name="chevron-right" color={colors.textSubtle} />
          </Pressable>
        ))}
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button style={{ flex: 1 }} variant="ai" iconLeft="photo-camera" label={t('aqua.scanFish')} onPress={() => router.push({ pathname: '/aquaculture/fish-scan', params: { pondId: pond.id } })} />
        <Button style={{ flex: 1 }} variant="secondary" iconLeft="mic" label={t('aquaX.askVoice')} onPress={() => router.push('/assistant/voice')} />
      </View>
      <AppText variant="bodySm" color={colors.textSubtle}>{t('aiInsight.disclaimer')}</AppText>
    </Screen>
  );
}
