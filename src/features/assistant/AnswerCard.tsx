import { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppText, Banner, Button, Card, Icon } from '@/components';
import { useLanguage } from '@/hooks/useLanguage';
import { speak, stopSpeaking } from '@/services/speech';
import { colors } from '@/theme';
import { Message, useSaveMessage } from './api';

// Assistant answer with Listen (TTS in app language), Save and Share — Stitch ai_follow_up_conversation card.
export function AnswerCard({ message, autoSpeak }: { message: Pick<Message, 'id' | 'content'>; autoSpeak?: boolean }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const save = useSaveMessage();
  const [speaking, setSpeaking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);

  const toggle = async () => {
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    setSpeaking(true);
    const ok = await speak(message.content, language, { onDone: () => setSpeaking(false) });
    if (!ok) { setSpeaking(false); setNoVoice(true); }
  };
  useEffect(() => { if (autoSpeak) toggle(); return () => { stopSpeaking(); }; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.avatar}><Icon name="auto-awesome" size={18} color={colors.white} /></View>
        <AppText variant="labelLg" color={colors.ai}>{t('assistant.ai')}</AppText>
      </View>
      <AppText variant="bodyLg" selectable>{message.content}</AppText>
      <View style={styles.actions}>
        <Button compact variant={speaking ? 'ai' : 'tonal'} iconLeft={speaking ? 'stop' : 'volume-up'} label={speaking ? t('assistant.stop') : t('assistant.listen')} onPress={toggle} />
        <Button compact variant="text" iconLeft={save.isSuccess ? 'bookmark' : 'bookmark-border'} label={save.isSuccess ? t('assistant.saved') : t('assistant.save')}
          disabled={save.isSuccess} loading={save.isPending} onPress={() => save.mutate(message)} />
        <Button compact variant="text" iconLeft="share" label={t('assistant.share')} onPress={() => Share.share({ message: message.content }).catch(() => {})} />
      </View>
      {noVoice && <Banner tone="warning" message={t('language.voiceUnavailable')} onDismiss={() => setNoVoice(false)} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, borderColor: 'rgba(101,70,199,0.2)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ai, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
});
