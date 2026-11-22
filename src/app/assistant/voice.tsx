// 32 · Voice Question Interface — Stitch: voice_search_agriaqua_360
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Header, Icon, Screen, TextField } from '@/components';
import { ask, AskResult, transcribe } from '@/features/assistant/api';
import { AnswerCard } from '@/features/assistant/AnswerCard';
import { useLanguage } from '@/hooks/useLanguage';
import { LANGUAGES } from '@/locales';
import { colors, fonts } from '@/theme';

const MAX_MS = 120_000;
type Stage = 'idle' | 'recording' | 'transcribing' | 'review' | 'asking' | 'answered';

export default function VoiceQuestion() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const params = useLocalSearchParams<{ id?: string }>();
  const recorder = useAudioRecorder({ ...RecordingPresets.LOW_QUALITY, numberOfChannels: 1 });
  const state = useAudioRecorderState(recorder, 250);
  const [stage, setStage] = useState<Stage>('idle');
  const [text, setText] = useState('');
  const [result, setResult] = useState<AskResult | null>(null);
  const [streamed, setStreamed] = useState('');
  const [notice, setNotice] = useState<{ tone: 'error' | 'warning'; key: string } | null>(null);
  const pulse = useSharedValue(1);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 2 - pulse.value }));

  useEffect(() => {
    if (stage === 'recording') pulse.value = withRepeat(withTiming(1.35, { duration: 900 }), -1, false);
    else { cancelAnimation(pulse); pulse.value = 1; }
  }, [stage, pulse]);

  const start = async () => {
    setNotice(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) { setNotice({ tone: 'warning', key: 'voice.micDenied' }); return; }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setStage('recording');
    } catch { setNotice({ tone: 'error', key: 'errors.generic' }); }
  };

  const stop = async (timedOut = false) => {
    if (stage !== 'recording') return;
    await recorder.stop();
    if (timedOut) setNotice({ tone: 'warning', key: 'voice.maxReached' });
    if (!recorder.uri) { setStage('idle'); setNotice({ tone: 'error', key: 'voice.noSpeech' }); return; }
    setStage('transcribing');
    try {
      const r = await transcribe(recorder.uri, language);
      if (r.unclear || !r.text.trim()) { setStage('idle'); setNotice({ tone: 'warning', key: 'voice.noSpeech' }); return; }
      setText(r.text); setStage('review');
    } catch (e) {
      setStage('idle');
      setNotice({ tone: 'error', key: (e as Error).message.startsWith('errors.') ? (e as Error).message : 'errors.generic' });
    }
  };
  const cancel = async () => { if (stage === 'recording') await recorder.stop(); setStage('idle'); };

  useEffect(() => { if (stage === 'recording' && state.durationMillis >= MAX_MS) stop(true); }, [state.durationMillis]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!text.trim()) return;
    setStage('asking'); setNotice(null);
    try {
      setStreamed('');
      setResult(await ask({ message: text.trim(), conversationId: params.id ?? null, inputMode: 'voice', language, onDelta: setStreamed }));
      setStage('answered');
    } catch (e) {
      setStage('review');
      setNotice({ tone: 'error', key: (e as Error).message.startsWith('errors.') ? (e as Error).message : 'errors.generic' });
    }
  };

  const secs = Math.floor(state.durationMillis / 1000);
  const recording = stage === 'recording';
  const langName = LANGUAGES.find((l) => l.code === language)!.native;

  return (
    <Screen>
      <Header title={t('voice.title')} />
      {(stage === 'idle' || recording || stage === 'transcribing') && (
        <View style={styles.center}>
          <AppText variant="labelLg" color={colors.textMuted}>{langName}</AppText>
          <View style={styles.micWrap}>
            <Animated.View style={[styles.ring, ring]} />
            <Pressable testID="voice-mic" accessibilityRole="button" accessibilityLabel={recording ? t('voice.stop') : t('voice.tapToSpeak')}
              disabled={stage === 'transcribing'} onPress={() => (recording ? stop() : start())} style={[styles.mic, recording && { backgroundColor: colors.error }]}>
              <Icon name={recording ? 'stop' : 'mic'} size={48} color={colors.white} />
              <AppText variant="labelMd" color={colors.white}>{recording ? t('voice.stop') : t('voice.tapToSpeak')}</AppText>
            </Pressable>
          </View>
          {recording && (
            <>
              <AppText style={styles.timer} accessibilityLiveRegion="polite">{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</AppText>
              <AppText variant="bodyMd" color={colors.error}>{t('voice.listening')}</AppText>
              <Button variant="text" iconLeft="close" label={t('voice.cancel')} onPress={cancel} />
            </>
          )}
          {stage === 'transcribing' && <AppText variant="bodyMd" color={colors.ai}>{t('voice.transcribing')}</AppText>}
          {stage === 'idle' && <AppText variant="bodyMd" color={colors.textMuted} align="center">{t('voice.hint')}</AppText>}
        </View>
      )}

      {notice && <Banner tone={notice.tone} message={t(notice.key)} onDismiss={() => setNotice(null)} />}

      {(stage === 'review' || stage === 'asking') && (
        <Card style={{ gap: 12 }}>
          <TextField testID="voice-text" label={t('voice.youSaid')} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} value={text} onChangeText={setText} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button style={{ flex: 1 }} variant="secondary" iconLeft="mic" label={t('voice.recordAgain')} disabled={stage === 'asking'} onPress={() => { setText(''); start(); }} />
            <Button testID="voice-submit" style={{ flex: 1 }} variant="ai" icon="arrow-forward" label={t('voice.submit')} loading={stage === 'asking'} onPress={submit} />
          </View>
        </Card>
      )}

      {stage === 'asking' && !!streamed && <Card><AppText variant="bodyLg" accessibilityLiveRegion="polite">{streamed}</AppText></Card>}

      {stage === 'answered' && result && (
        <>
          <Card style={{ backgroundColor: colors.primaryDeep }}><AppText variant="bodyLg" color={colors.white}>{text}</AppText></Card>
          <AnswerCard message={result.message} autoSpeak />
          {result.recommend_expert && <Banner tone="warning" message={t('assistant.expert')} />}
          <Button iconLeft="forum" label={t('voice.openChat')} onPress={() => router.replace({ pathname: '/assistant', params: { id: result.conversation_id } })} />
          <Button variant="secondary" iconLeft="mic" label={t('voice.recordAgain')} onPress={() => { setText(''); setResult(null); setStage('idle'); }} />
        </>
      )}
      {stage === 'idle' && <Button variant="text" iconLeft="keyboard" label={t('voice.typeInstead')} onPress={() => router.replace({ pathname: '/assistant', params: params.id ? { id: params.id } : {} })} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 16, paddingVertical: 24 },
  micWrap: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: colors.mint },
  mic: { width: 160, height: 160, borderRadius: 80, backgroundColor: colors.primaryDeep, alignItems: 'center', justifyContent: 'center', gap: 6 },
  timer: { fontFamily: fonts.headingXBold, fontSize: 32, lineHeight: 40, color: colors.text },
});
