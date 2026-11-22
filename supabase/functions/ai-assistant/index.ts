// POST { message, conversation_id?, image_paths?, input_mode, language }
//  → stores the user message + AI reply in ai_conversations / ai_messages; returns { conversation_id, message }.
import { cors, fail, json } from '../_shared/http.ts';
import { userClient } from '../_shared/supabase.ts';
import { generateJson, toBase64 } from '../_shared/gemini.ts';
import { assistantPrompt, assistantSchema, AssistantReply } from '../_shared/assistant.ts';

const HISTORY = 12;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const sb = userClient(req);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail('unauthorized', 401);
  const uid = auth.user.id;

  let b: { message?: unknown; conversation_id?: unknown; image_paths?: unknown; input_mode?: unknown; language?: unknown };
  try { b = await req.json(); } catch { return fail('bad_request'); }
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, 2000) : '';
  const images = Array.isArray(b.image_paths) ? b.image_paths : [];
  if (!message && !images.length) return fail('bad_request');
  if (images.length > 3 || !images.every((p) => typeof p === 'string' && p.startsWith(`${uid}/`))) return fail('bad_request');
  const language = ['en', 'te', 'hi'].includes(b.language as string) ? (b.language as string) : 'en';
  const inputMode = ['text', 'voice', 'image'].includes(b.input_mode as string) ? (b.input_mode as string) : 'text';

  // Conversation: reuse the caller's own (RLS) or create one.
  let conversationId = typeof b.conversation_id === 'string' ? b.conversation_id : null;
  if (conversationId) {
    const { data } = await sb.from('ai_conversations').select('id').eq('id', conversationId).maybeSingle();
    if (!data) return fail('not_found', 404);
  } else {
    const { data, error } = await sb.from('ai_conversations').insert({ owner_id: uid, language, title: message.slice(0, 60) || null }).select('id').single();
    if (error) return fail('ai_failed', 500);
    conversationId = data.id;
  }

  const [history, context] = await Promise.all([
    sb.from('ai_messages').select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(HISTORY),
    farmContext(sb),
  ]);
  const { error: insErr } = await sb.from('ai_messages').insert({ owner_id: uid, conversation_id: conversationId, role: 'user', content: message || '(photo)', input_mode: inputMode, image_paths: images });
  if (insErr) return fail('ai_failed', 500);

  try {
    const imageParts = await Promise.all(images.map(async (p: string) => {
      const { data, error } = await sb.storage.from('media').download(p);
      if (error || !data) throw new Error('image_missing');
      return { inline_data: { mime_type: data.type || 'image/jpeg', data: toBase64(new Uint8Array(await data.arrayBuffer())) } };
    }));
    const past = (history.data ?? []).reverse().map((m: { role: string; content: string }) => `${m.role === 'user' ? 'Farmer' : 'Assistant'}: ${m.content}`).join('\n');
    const r = await generateJson<AssistantReply>({
      system: assistantPrompt(language, context),
      parts: [...imageParts, { text: `${past ? `Conversation so far:\n${past}\n\n` : ''}Farmer: ${message || 'Please look at the photo(s) and tell me what you see and what I should do.'}` }],
      schema: assistantSchema,
      temperature: 0.4,
    });
    const { data: saved, error } = await sb.from('ai_messages').insert({ owner_id: uid, conversation_id: conversationId, role: 'assistant', content: r.reply }).select().single();
    if (error) throw error;
    await sb.from('ai_conversations').update({ topic: r.topic, ...(history.data?.length ? {} : { title: r.title.slice(0, 80) }) }).eq('id', conversationId);
    return json({ conversation_id: conversationId, message: saved, follow_ups: r.follow_ups.slice(0, 3), recommend_expert: r.recommend_expert });
  } catch (e) {
    const code = e instanceof Error && ['ai_busy', 'ai_timeout', 'ai_blocked', 'ai_not_configured', 'image_missing'].includes(e.message) ? e.message : 'ai_failed';
    console.error('ai-assistant', e);
    return json({ error: code, conversation_id: conversationId }, code === 'ai_busy' ? 429 : 502);
  }
});

// Compact summary of the farmer's own data (RLS-scoped) so answers can reference their crops, ponds and animals.
async function farmContext(sb: ReturnType<typeof userClient>) {
  const [profile, crops, ponds, wq, animals, vacc] = await Promise.all([
    sb.from('profiles').select('village, district, state, sectors, land_acres').maybeSingle(),
    sb.from('crops').select('name, variety, season, sowing_date, status').eq('status', 'growing').limit(10),
    sb.from('ponds').select('id, name, species, stocking_date, status').limit(10),
    sb.from('water_quality_records').select('pond_id, recorded_at, ph, dissolved_oxygen_mgl, temperature_c, ammonia_mgl, salinity_ppt').order('recorded_at', { ascending: false }).limit(10),
    sb.from('livestock').select('species, status').neq('status', 'sold').neq('status', 'deceased').limit(200),
    sb.from('vaccination_records').select('vaccine_name, due_on').eq('status', 'scheduled').order('due_on').limit(5),
  ]);
  const counts: Record<string, number> = {};
  (animals.data ?? []).forEach((a: { species: string; status: string }) => { counts[`${a.species}_${a.status}`] = (counts[`${a.species}_${a.status}`] ?? 0) + 1; });
  return {
    location: profile.data, crops_growing: crops.data ?? [],
    ponds: (ponds.data ?? []).map((p: { id: string }) => ({ ...p, id: undefined, latest_water: (wq.data ?? []).find((w: { pond_id: string }) => w.pond_id === p.id) ?? null })),
    animals_by_species_status: counts, upcoming_vaccinations: vacc.data ?? [],
  };
}
