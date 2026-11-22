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
  // Fast path: raw audio in the request body (no Storage round trips). Legacy path: { audio_path } JSON.
  let audio: Uint8Array;
  let language: string;
  let path: string | null = null;
  if ((req.headers.get('Content-Type') ?? '').startsWith('audio/')) {
    language = req.headers.get('x-language') ?? 'en';
    if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BYTES) return fail('audio_too_long');
    audio = new Uint8Array(await req.arrayBuffer());
    if (!audio.length) return fail('bad_request');
    if (audio.length > MAX_BYTES) return fail('audio_too_long');
  } else {
    let body: { audio_path?: unknown; language?: unknown };
    try { body = await req.json(); } catch { return fail('bad_request'); }
    if (typeof body.audio_path !== 'string' || !body.audio_path.startsWith(`${auth.user.id}/`)) return fail('bad_request');
    path = body.audio_path;
    language = String(body.language ?? 'en');
    const { data: file, error } = await sb.storage.from('media').download(path);
    if (error || !file) return fail('audio_missing', 404);
    if (file.size > MAX_BYTES) return fail('audio_too_long');
    audio = new Uint8Array(await file.arrayBuffer());
  }
  if (!['en', 'te', 'hi'].includes(language)) language = 'en';

  try {
    const r = await generateJson<Transcript>({
      system: transcribePrompt(language),
      parts: [{ inline_data: { mime_type: 'audio/mp4', data: toBase64(audio) } }, { text: 'Transcribe.' }],
      schema: transcribeSchema,
      temperature: 0,
      maxOutputTokens: 512,
      models: FAST_MODELS,
      thinking: 'minimal',
    });
    return json(r);
  } catch (e) {
    const code = e instanceof Error && ['ai_busy', 'ai_timeout', 'ai_not_configured'].includes(e.message) ? e.message : 'ai_failed';
    return fail(code, code === 'ai_busy' ? 429 : 502);
  } finally {
    // Legacy uploads: voice clips are only needed for transcription; don't keep farmers' recordings.
    if (path) await sb.storage.from('media').remove([path]);
  }
});
