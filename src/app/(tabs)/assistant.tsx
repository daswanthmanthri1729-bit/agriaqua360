// 31 · AI Farming Assistant — Stitch: ask_anything_agriaqua_360, ai_follow_up_conversation_agriaqua_360, 40_ai_assistant_intelligence_hub
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Banner, Button, ChoiceChips, Icon, IconName, LogoMark, Skeleton, StorageImage } from '@/components';
import { ask, AskResult, Message, useMessages } from '@/features/assistant/api';
import { AnswerCard } from '@/features/assistant/AnswerCard';
import { useLanguage } from '@/hooks/useLanguage';
import { colors, fonts, radius, space } from '@/theme';

const SUGGESTIONS = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;

export default function Assistant() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const params = useLocalSearchParams<{ id?: string; q?: string }>();
  const [conversationId, setConversationId] = useState<string | null>(params.id ?? null);
  const messages = useMessages(conversationId);
  const [text, setText] = useState(params.q ?? '');   // ?q= prefills a question from other screens
  useEffect(() => { if (params.q) setText(params.q); }, [params.q]);
  const [pending, setPending] = useState<string | null>(null);
  const [streamed, setStreamed] = useState('');
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const [last, setLast] = useState<AskResult | null>(null);
  useEffect(() => { setConversationId(params.id ?? null); setLast(null); }, [params.id]);
  const list = useRef<FlatList<Message>>(null);

  const send = async (q = text) => {
    const message = q.trim();
    if (!message || pending) return;
    setText(''); setPending(message); setError(null); setStreamed('');
    try {
      const r = await ask({ message, conversationId, inputMode: 'text', language, onDelta: setStreamed });
      setConversationId(r.conversation_id);
      setLast(r);
    } catch (e) {
      setError({ key: (e as Error).message.startsWith('errors.') ? (e as Error).message : 'errors.generic', text: message });
    } finally { setPending(null); setStreamed(''); }
  };
  const newChat = () => { setConversationId(null); setLast(null); setError(null); router.setParams({ id: undefined }); };

  const data = messages.data ?? [];
  const tool = (icon: IconName, label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={onPress} style={({ pressed }) => [styles.tool, pressed && { backgroundColor: colors.surfaceHigh }]}>
      <Icon name={icon} color={colors.primaryDeep} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View style={styles.header}>
        <LogoMark size={36} />
        <View style={{ flex: 1 }}>
          <AppText variant="headlineMd" accessibilityRole="header">{t('assistant.title')}</AppText>
        </View>
        {tool('history', t('assistant.history'), () => router.push('/assistant/history'))}
        {tool('add-comment', t('assistant.newChat'), newChat)}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          ref={list}
          data={data}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: space.md, gap: 12, flexGrow: 1 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={conversationId && messages.isLoading ? <Skeleton height={140} /> : (
            <View style={{ gap: 16 }}>
              <View style={styles.hero}>
                <View style={styles.heroIcon}><Icon name="auto-awesome" size={32} color={colors.white} /></View>
                <AppText variant="bodyLg" color={colors.textMuted} align="center">{t('assistant.subtitle')}</AppText>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button style={{ flex: 1 }} variant="ai" iconLeft="mic" label={t('assistant.voice')} onPress={() => router.push('/assistant/voice')} />
                <Button style={{ flex: 1 }} variant="tonal" iconLeft="photo-camera" label={t('assistant.photo')} onPress={() => router.push('/assistant/image')} />
              </View>
              <AppText variant="labelLg">{t('assistant.tryAsking')}</AppText>
              {SUGGESTIONS.map((k) => (
                <Pressable key={k} accessibilityRole="button" onPress={() => send(t(`assistant.${k}`))} style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.surfaceLow }]}>
                  <Icon name="chat-bubble-outline" size={18} color={colors.primary} />
                  <AppText variant="bodyMd" style={{ flex: 1 }}>{t(`assistant.${k}`)}</AppText>
                </Pressable>
              ))}
            </View>
          )}
          renderItem={({ item: m }) => m.role === 'user' ? (
            <View style={styles.userBubble}>
              {!!m.image_paths.length && (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {m.image_paths.map((p) => <StorageImage key={p} path={p} style={{ width: 90, height: 90, borderRadius: radius.md }} />)}
                </View>
              )}
              <AppText variant="bodyLg" color={colors.white}>{m.content === '(photo)' ? t('assistant.photoMessage') : m.content}</AppText>
              {m.input_mode === 'voice' && <Icon name="mic" size={14} color={colors.mint} />}
            </View>
          ) : <AnswerCard message={m} />}
          ListFooterComponent={
            <View style={{ gap: 10 }}>
              {pending && (
                <>
                  <View style={styles.userBubble}><AppText variant="bodyLg" color={colors.white}>{pending}</AppText></View>
                  {streamed ? (
                    <View style={styles.streaming} accessibilityLiveRegion="polite"><AppText variant="bodyLg">{streamed}</AppText></View>
                  ) : (
                    <View style={styles.thinking}><Icon name="auto-awesome" size={18} color={colors.ai} /><AppText variant="bodyMd" color={colors.ai}>{t('assistant.thinking')}</AppText></View>
                  )}
                </>
              )}
              {error && (
                <View style={{ gap: 8 }}>
                  <Banner tone="error" title={t('assistant.failed')} message={t(error.key)} />
                  <Button compact variant="secondary" iconLeft="refresh" label={t('assistant.retry')} onPress={() => send(error.text)} />
                </View>
              )}
              {last?.recommend_expert && !pending && <Banner tone="warning" message={t('assistant.expert')} />}
              {!!last?.follow_ups.length && !pending && (
                <ChoiceChips scroll label={t('assistant.askNext')} value={null} onChange={(q) => send(q)} options={last.follow_ups.map((q) => ({ value: q, label: q }))} />
              )}
              {data.length > 0 && <AppText variant="labelSm" color={colors.textSubtle} align="center">{t('assistant.note')}</AppText>}
            </View>
          }
        />
        <View style={styles.composer}>
          {tool('photo-camera', t('assistant.photo'), () => router.push({ pathname: '/assistant/image', params: conversationId ? { id: conversationId } : {} }))}
          <TextInput
            testID="chat-input"
            accessibilityLabel={t('assistant.placeholder')}
            style={styles.input}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={colors.outline}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          {text.trim() ? (
            <Pressable testID="chat-send" accessibilityRole="button" accessibilityLabel={t('assistant.send')} onPress={() => send()} disabled={!!pending} style={[styles.round, { backgroundColor: colors.primaryDeep }]}>
              <Icon name="send" color={colors.white} />
            </Pressable>
          ) : (
            <Pressable accessibilityRole="button" accessibilityLabel={t('assistant.voice')} onPress={() => router.push({ pathname: '/assistant/voice', params: conversationId ? { id: conversationId } : {} })} style={[styles.round, { backgroundColor: colors.ai }]}>
              <Icon name="mic" color={colors.white} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingTop: space.sm },
  tool: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceContainer },
  hero: { alignItems: 'center', gap: 12, paddingVertical: 12 },
  heroIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ai, alignItems: 'center', justifyContent: 'center' },
  suggestion: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  userBubble: { alignSelf: 'flex-end', maxWidth: '85%', gap: 6, padding: 14, borderRadius: radius.lg, borderBottomRightRadius: 4, backgroundColor: colors.primaryDeep },
  streaming: { padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'rgba(101,70,199,0.2)' },
  thinking: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: radius.lg, backgroundColor: colors.aiSurface, alignSelf: 'flex-start' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: space.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: colors.surfaceLow, fontFamily: fonts.body, fontSize: 16, color: colors.text },
  round: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
