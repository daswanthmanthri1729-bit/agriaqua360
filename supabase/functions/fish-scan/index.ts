// POST { image_paths, pond_id?, observations?, language }  →  Gemini fish-health report saved to fish_health_reports.
import { cors, fail, json } from '../_shared/http.ts';
import { userClient } from '../_shared/supabase.ts';
import { generateJson, toBase64 } from '../_shared/gemini.ts';
import { fishReportSchema, fishSystemPrompt, FishReport } from '../_shared/fish-prompt.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const sb = userClient(req);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail('unauthorized', 401);

  let body: { image_paths?: unknown; pond_id?: unknown; observations?: unknown; language?: unknown };
  try { body = await req.json(); } catch { return fail('bad_request'); }
  const paths = body.image_paths;
  // Paths must be the caller's own uploads (storage RLS enforces this too).
  if (!Array.isArray(paths) || paths.length < 1 || paths.length > 5 || !paths.every((p) => typeof p === 'string' && p.startsWith(`${auth.user!.id}/`))) return fail('bad_request');
  const language = ['en', 'te', 'hi'].includes(body.language as string) ? (body.language as string) : 'en';
  const observations = typeof body.observations === 'string' ? body.observations.slice(0, 500) : '';
  const pondId = typeof body.pond_id === 'string' ? body.pond_id : null;

  const pond = pondId ? (await sb.from('ponds').select('name, species, stocking_date').eq('id', pondId).maybeSingle()).data : null;
  if (pondId && !pond) return fail('not_found', 404);
  const reading = pondId
    ? (await sb.from('water_quality_records').select('recorded_at, ph, dissolved_oxygen_mgl, temperature_c, ammonia_mgl, salinity_ppt, turbidity_cm').eq('pond_id', pondId).order('recorded_at', { ascending: false }).limit(1).maybeSingle()).data
    : null;

  try {
    const images = await Promise.all(paths.map(async (p: string) => {
      const { data, error } = await sb.storage.from('media').download(p);
      if (error || !data) throw new Error('image_missing');
      return { inline_data: { mime_type: data.type || 'image/jpeg', data: toBase64(new Uint8Array(await data.arrayBuffer())) } };
    }));
    const report = await generateJson<FishReport>({
      system: fishSystemPrompt(language, pond, reading, observations),
      parts: [...images, { text: `Analyse these ${images.length} photo(s) and return the JSON report.` }],
      schema: fishReportSchema,
    });
    const { data: saved, error } = await sb.from('fish_health_reports').insert({
      owner_id: auth.user.id,
      pond_id: pondId,
      image_paths: paths,
      observations: observations || null,
      condition_name: report.condition_name,
      confidence: report.confidence,
      severity: report.severity,
      summary: report.summary,
      recommend_expert: report.recommend_expert || report.confidence === 'low' || report.severity === 'severe',
      raw_response: report,
    }).select().single();
    if (error) throw error;
    await sb.from('activity_logs').insert({ owner_id: auth.user.id, action: 'fish_scan', entity_type: 'fish_health', entity_id: saved.id });
    return json(saved);
  } catch (e) {
    const code = e instanceof Error && ['ai_busy', 'ai_timeout', 'ai_blocked', 'ai_not_configured', 'image_missing'].includes(e.message) ? e.message : 'ai_failed';
    console.error('fish-scan', e);
    return fail(code, code === 'ai_busy' ? 429 : 502);
  }
});
