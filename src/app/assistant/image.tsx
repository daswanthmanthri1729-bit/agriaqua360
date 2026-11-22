// 33 · Ask AI Using Images — Stitch: visual_search_agriaqua_360
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, ChoiceChips, Header, PhotoPicker, Screen, TextField } from '@/components';
import { ask, AskResult } from '@/features/assistant/api';
import { AnswerCard } from '@/features/assistant/AnswerCard';
import { useLanguage } from '@/hooks/useLanguage';
import type { PickedImage } from '@/services/media';
import { colors } from '@/theme';

export default function ImageQuestion() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const params = useLocalSearchParams<{ id?: string }>();
  const [photos, setPhotos] = useState<PickedImage[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AskResult | null>(null);
  const [streamed, setStreamed] = useState('');

  const send = async () => {
    if (!photos.length) { setError('imageAsk.needPhoto'); return; }
    setBusy(true); setError(null);
    try {
      setStreamed('');
      setResult(await ask({ message: question.trim(), images: photos, conversationId: params.id ?? null, inputMode: 'image', language, onDelta: setStreamed }));
    } catch (e) {
      setError((e as Error).message.startsWith('errors.') ? (e as Error).message : 'errors.generic');
    } finally { setBusy(false); }
  };

  if (result) {
    return (
      <Screen>
        <Header title={t('imageAsk.title')} />
        <AnswerCard message={result.message} />
        {result.recommend_expert && <Banner tone="warning" message={t('assistant.expert')} />}
        <AppText variant="labelSm" color={colors.textSubtle} align="center">{t('assistant.note')}</AppText>
        <Button iconLeft="forum" label={t('voice.openChat')} onPress={() => router.replace({ pathname: '/assistant', params: { id: result.conversation_id } })} />
        <Button variant="secondary" iconLeft="add-a-photo" label={t('imageAsk.title')} onPress={() => { setResult(null); setPhotos([]); setQuestion(''); }} />
      </Screen>
    );
  }
  return (
    <Screen footer={<Button testID="image-send" variant="ai" iconLeft="auto-awesome" label={busy ? t('assistant.thinking') : t('imageAsk.send')} loading={busy} onPress={send} />}>
      <Header title={t('imageAsk.title')} />
      <AppText variant="bodyLg" color={colors.textMuted}>{t('imageAsk.subtitle')}</AppText>
      <PhotoPicker label={t('scan.photos', { count: photos.length }).replace('/5', '/3')} value={photos} onChange={setPhotos} max={3} />
      <TextField testID="image-question" label={t('imageAsk.question')} placeholder={t('imageAsk.questionPlaceholder')} multiline maxLength={500}
        style={{ minHeight: 72, textAlignVertical: 'top' }} value={question} onChangeText={setQuestion} />
      <ChoiceChips scroll value={null} onChange={(k) => setQuestion(t(`imageAsk.${k}`))}
        options={(['q1', 'q2', 'q3', 'q4'] as const).map((k) => ({ value: k, label: t(`imageAsk.${k}`) }))} />
      {busy && !!streamed && <Card><AppText variant="bodyLg" accessibilityLiveRegion="polite">{streamed}</AppText></Card>}
      <Banner tone="ai" message={t('help.aiText')} />
      {error && <Banner tone="error" message={t(error)} onDismiss={() => setError(null)} />}
    </Screen>
  );
}
