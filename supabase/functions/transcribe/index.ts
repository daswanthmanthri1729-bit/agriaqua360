// POST { audio_path, language } → { text, language, unclear }. Recording is the caller's own upload in the media bucket.
import { cors, fail, json } from '../_shared/http.ts';
import { userClient } from '../_shared/supabase.ts';
import { FAST_MODELS, generateJson, toBase64 } from '../_shared/gemini.ts';
import { transcribePrompt, transcribeSchema, Transcript } from '../_shared/assistant.ts';

const MAX_BYTES = 5 * 1024 * 1024; // ~10 min of 64 kbps AAC; the app caps recordings at 2 min

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const sb = userClient(req);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail('unauthorized', 401);
  let body: { audio_path?: unknown; language?: unknown };
  try { body = await req.json(); } catch { return fail('bad_request'); }
  const path = body.audio_path;
  if (typeof path !== 'string' || !path.startsWith(`${auth.user.id}/`)) return fail('bad_request');
  const language = ['en', 'te', 'hi'].includes(body.language as string) ? (body.language as string) : 'en';

  const { data: file, error } = await sb.storage.from('media').download(path);
  if (error || !file) return fail('audio_missing', 404);
  if (file.size > MAX_BYTES) return fail('audio_too_long');
  try {
    const r = await generateJson<Transcript>({
      system: transcribePrompt(language),
      parts: [{ inline_data: { mime_type: 'audio/mp4', data: toBase64(new Uint8Array(await file.arrayBuffer())) } }, { text: 'Transcribe.' }],
      schema: transcribeSchema,
      temperature: 0,
      maxOutputTokens: 512,
      models: FAST_MODELS,
    });
    return json(r);
  } catch (e) {
    const code = e instanceof Error && ['ai_busy', 'ai_timeout', 'ai_not_configured'].includes(e.message) ? e.message : 'ai_failed';
    return fail(code, code === 'ai_busy' ? 429 : 502);
  } finally {
    // Voice clips are only needed for transcription; don't keep farmers' recordings.
    await sb.storage.from('media').remove([path]);
  }
});
