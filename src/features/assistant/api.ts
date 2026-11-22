import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { invoke, must, queryClient, userId } from '@/lib/query';
import { PickedImage, uploadFile, uploadImage } from '@/services/media';
import type { Language } from '@/locales';

export type Conversation = { id: string; title: string | null; topic: string | null; language: Language; created_at: string; updated_at: string };
export type Message = { id: string; conversation_id: string; role: 'user' | 'assistant'; content: string; input_mode: 'text' | 'voice' | 'image'; image_paths: string[]; created_at: string };
export type AskResult = { conversation_id: string; message: Message; follow_ups: string[]; recommend_expert: boolean };

export const useConversations = () =>
  useQuery({ queryKey: ['conversations'], queryFn: () => must<Conversation[]>(supabase.from('ai_conversations').select('*').order('updated_at', { ascending: false }).limit(50)) });

export const useMessages = (conversationId: string | null) =>
  useQuery({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    queryFn: () => must<Message[]>(supabase.from('ai_messages').select('*').eq('conversation_id', conversationId!).order('created_at').limit(200)),
  });

export async function ask(a: { message: string; conversationId: string | null; images?: PickedImage[]; inputMode: 'text' | 'voice' | 'image'; language: Language }) {
  const uid = await userId();
  const image_paths = await Promise.all((a.images ?? []).map((img) => uploadImage('media', 'assistant', uid, img)));
  try {
    return await invoke<AskResult>('ai-assistant', { message: a.message, conversation_id: a.conversationId, image_paths, input_mode: a.inputMode, language: a.language });
  } finally {
    // The farmer's message is stored even when the AI fails, so refresh either way.
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }
}

/** Uploads a voice recording (m4a) and returns its transcript. The server deletes the clip afterwards. */
export async function transcribe(uri: string, language: Language) {
  const path = await uploadFile('media', 'assistant', await userId(), uri, 'audio/mp4', 'm4a');
  return invoke<{ text: string; language: string; unclear: boolean }>('transcribe', { audio_path: path, language });
}

export const useDeleteConversation = () =>
  useMutation({ mutationFn: (id: string) => must(supabase.from('ai_conversations').delete().eq('id', id)), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }) });

export const useSaveMessage = () =>
  useMutation({
    mutationFn: (m: Pick<Message, 'id' | 'content'>) =>
      must(supabase.from('saved_records').upsert({ record_type: 'ai_message', record_id: m.id, title: m.content.slice(0, 80) }, { onConflict: 'owner_id,record_type,record_id' })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved'] }),
  });
