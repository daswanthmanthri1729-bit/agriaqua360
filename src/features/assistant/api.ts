import { useMutation, useQuery } from '@tanstack/react-query';
import { fetch as streamingFetch } from 'expo/fetch';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';
import { invoke, must, queryClient, userId } from '@/lib/query';
import { PickedImage, uploadImage } from '@/services/media';
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

type AskArgs = { message: string; conversationId: string | null; images?: PickedImage[]; inputMode: 'text' | 'voice' | 'image'; language: Language; onDelta?: (text: string) => void };

export async function ask(a: AskArgs) {
  const uid = await userId();
  const image_paths = await Promise.all((a.images ?? []).map((img) => uploadImage('media', 'assistant', uid, img)));
  const body = { message: a.message, conversation_id: a.conversationId, image_paths, input_mode: a.inputMode, language: a.language };
  try {
    return a.onDelta ? await askStreaming(body, a.onDelta) : await invoke<AskResult>('ai-assistant', body);
  } finally {
    // The farmer's message is stored even when the AI fails, so refresh either way.
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  }
}

/** Sends the voice recording (m4a) straight to the server and returns its transcript. Nothing is stored. */
export async function transcribe(uri: string, language: Language) {
  const audio = await (await fetch(uri)).arrayBuffer();
  const { data, error } = await supabase.functions.invoke('transcribe', { body: audio, headers: { 'Content-Type': 'audio/mp4', 'x-language': language } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const code = ctx && typeof ctx.json === 'function' ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(code ? `errors.${code}` : 'errors.network');
  }
  return data as { text: string; language: string; unclear: boolean };
}

export const useDeleteConversation = () =>
  useMutation({ mutationFn: (id: string) => must(supabase.from('ai_conversations').delete().eq('id', id)), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }) });

export const useSaveMessage = () =>
  useMutation({
    mutationFn: (m: Pick<Message, 'id' | 'content'>) =>
      must(supabase.from('saved_records').upsert({ record_type: 'ai_message', record_id: m.id, title: m.content.slice(0, 80) }, { onConflict: 'owner_id,record_type,record_id' })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved'] }),
  });

/** Streams the answer (Server-Sent Events) so the farmer sees words as they are written. */
async function askStreaming(body: Record<string, unknown>, onDelta: (text: string) => void): Promise<AskResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('errors.sessionExpired');
  let res;
  try {
    res = await streamingFetch(`${env.supabaseUrl}/functions/v1/ai-assistant`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: env.supabaseKey, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ ...body, stream: true }),
    });
  } catch {
    throw new Error('errors.network');
  }
  if (!res.ok || !res.body) {
    const code = (await res.json().catch(() => null))?.error;
    throw new Error(code ? `errors.${code}` : 'errors.network');
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i); buf = buf.slice(i + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const payload = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || !payload) continue;
      const d = JSON.parse(payload);
      if (event === 'delta') onDelta(d.text);
      else if (event === 'done') return d as AskResult;
      else if (event === 'error') throw new Error(`errors.${d.error}`);
    }
  }
  throw new Error('errors.network'); // stream ended without "done"
}
