// POST { message, conversation_id?, image_paths?, input_mode, language }
//  → stores the user message + AI reply in ai_conversations / ai_messages; returns { conversation_id, message }.
import { cors, fail, json } from '../_shared/http.ts';
import { userClient } from '../_shared/supabase.ts';
import { CHAT_MODELS, generateJson, streamJson, toBase64, VISION_MODELS } from '../_shared/gemini.ts';
import { assistantPrompt, assistantSchema, AssistantReply } from '../_shared/assistant.ts';

const HISTORY = 12;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const t0 = Date.now();
  const marks: Record<string, number> = {};
  const sb = userClient(req);
  // getClaims verifies the JWT locally with the project's cached signing keys (no Auth-server round trip).
  // The edge client has no stored session, so the caller's token must be passed explicitly.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: claims } = await sb.auth.getClaims(token);
  const uid = claims?.claims?.sub;
  if (!uid) return fail('unauthorized', 401);
  marks.auth = Date.now() - t0;

  let b: { message?: unknown; conversation_id?: unknown; image_paths?: unknown; input_mode?: unknown; language?: unknown; stream?: unknown };
  try { b = await req.json(); } catch { return fail('bad_request'); }
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, 2000) : '';
  const images = Array.isArray(b.image_paths) ? b.image_paths : [];
  if (!message && !images.length) return fail('bad_request');
  if (images.length > 3 || !images.every((p) => typeof p === 'string' && p.startsWith(`${uid}/`))) return fail('bad_request');
  const language = ['en', 'te', 'hi'].includes(b.language as string) ? (b.language as string) : 'en';
  const inputMode = ['text', 'voice', 'image'].includes(b.input_mode as string) ? (b.input_mode as string) : 'text';
  const existing = typeof b.conversation_id === 'string' ? b.conversation_id : null;

  // Conversation check/create, history and farm context run in parallel (one round trip instead of ~8).
  const [conv, history, context] = await Promise.all([
    existing
      ? sb.from('ai_conversations').select('id').eq('id', existing).maybeSingle()
      : sb.from('ai_conversations').insert({ owner_id: uid, language, title: message.slice(0, 60) || null }).select('id').single(),
    existing
      ? sb.from('ai_messages').select('role, content').eq('conversation_id', existing).order('created_at', { ascending: false }).limit(HISTORY)
      : Promise.resolve({ data: [] as { role: string; content: string }[] }),
    sb.rpc('farm_context').then((r) => r.data ?? {}),
  ]);
  if (!conv.data) return fail(existing ? 'not_found' : 'ai_failed', existing ? 404 : 500); // RLS: only the caller's own conversation
  const conversationId: string = conv.data.id;
  marks.context = Date.now() - t0;
  const { error: insErr } = await sb.from('ai_messages').insert({ owner_id: uid, conversation_id: conversationId, role: 'user', content: message || '(photo)', input_mode: inputMode, image_paths: images });
  if (insErr) return fail('ai_failed', 500);

  const generate = async (onText?: (t: string) => void) => {
    const imageParts = await Promise.all(images.map(async (p: string) => {
      const { data, error } = await sb.storage.from('media').download(p);
      if (error || !data) throw new Error('image_missing');
      return { inline_data: { mime_type: data.type || 'image/jpeg', data: toBase64(new Uint8Array(await data.arrayBuffer())) } };
    }));
    const past = (history.data ?? []).reverse().map((m: { role: string; content: string }) => `${m.role === 'user' ? 'Farmer' : 'Assistant'}: ${m.content}`).join('\n');
    const req = {
      system: assistantPrompt(language, context),
      parts: [...imageParts, { text: `${past ? `Conversation so far:\n${past}\n\n` : ''}Farmer: ${message || 'Please look at the photo(s) and tell me what you see and what I should do.'}` }],
      schema: assistantSchema,
      temperature: 0.4,
      maxOutputTokens: 1536,
      models: imageParts.length ? VISION_MODELS : CHAT_MODELS,
      thinking: imageParts.length ? 'low' as const : 'minimal' as const,
    };
    marks.ready = Date.now() - t0;
    let r: AssistantReply;
    try {
      r = onText ? await streamJson<AssistantReply>({ ...req, streamField: 'reply' }, onText) : await generateJson<AssistantReply>(req);
    } catch (e) {
      // A stream cut short mid-answer: get the complete answer without streaming (the client replaces the partial text).
      if (!(e instanceof Error && e.message === 'ai_stream_incomplete')) throw e;
      r = await generateJson<AssistantReply>(req);
    }
    const { data: saved, error } = await sb.from('ai_messages').insert({ owner_id: uid, conversation_id: conversationId, role: 'assistant', content: r.reply }).select().single();
    if (error) throw error;
    await sb.from('ai_conversations').update({ topic: r.topic, ...(history.data?.length ? {} : { title: r.title.slice(0, 80) }) }).eq('id', conversationId);
    marks.total = Date.now() - t0;
    console.log(JSON.stringify({ fn: 'ai-assistant', ...marks }));
    return { conversation_id: conversationId, message: saved, follow_ups: r.follow_ups.slice(0, 3), recommend_expert: r.recommend_expert, timing: marks };
  };
  const errorCode = (e: unknown) => (e instanceof Error && ['ai_busy', 'ai_timeout', 'ai_blocked', 'ai_not_configured', 'image_missing'].includes(e.message) ? e.message : 'ai_failed');

  // Streaming (Server-Sent Events): "delta" events carry the growing answer, "done" the saved message.
  if (b.stream === true) {
    const enc = new TextEncoder();
    const body = new ReadableStream({
      async start(ctrl) {
        const send = (event: string, data: unknown) => ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        try {
          send('done', await generate((text) => send('delta', { text })));
        } catch (e) {
          console.error('ai-assistant stream', e);
          send('error', { error: errorCode(e), conversation_id: conversationId });
        }
        ctrl.close();
      },
    });
    return new Response(body, { headers: { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
  }

  try {
    return json(await generate());
  } catch (e) {
    const code = errorCode(e);
    console.error('ai-assistant', e);
    return json({ error: code, conversation_id: conversationId }, code === 'ai_busy' ? 429 : 502);
  }
});
