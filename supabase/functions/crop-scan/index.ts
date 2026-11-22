// POST { scan_id }  →  analyses the scan's photos with Gemini, stores a disease_report, returns it.
import { cors, fail, json } from '../_shared/http.ts';
import { userClient } from '../_shared/supabase.ts';
import { generateJson, toBase64, VISION_MODELS } from '../_shared/gemini.ts';
import { cropReportSchema, cropSystemPrompt, CropReport } from '../_shared/crop-prompt.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const sb = userClient(req);
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return fail('unauthorized', 401);

  let scanId: string;
  try { scanId = (await req.json()).scan_id; } catch { return fail('bad_request'); }
  if (typeof scanId !== 'string') return fail('bad_request');

  // RLS guarantees this only returns the caller's own scan.
  const { data: scan } = await sb.from('crop_scans').select('id, image_paths, scan_type, language, crop:crops(name, variety, sowing_date)').eq('id', scanId).maybeSingle();
  if (!scan) return fail('not_found', 404);

  try {
    const images = await Promise.all(scan.image_paths.map(async (p: string) => {
      const { data, error } = await sb.storage.from('media').download(p);
      if (error || !data) throw new Error('image_missing');
      return { inline_data: { mime_type: data.type || 'image/jpeg', data: toBase64(new Uint8Array(await data.arrayBuffer())) } };
    }));
    const report = await generateJson<CropReport>({
      system: cropSystemPrompt(scan.language, scan.scan_type, scan.crop as never),
      parts: [...images, { text: `Analyse these ${images.length} photo(s) and return the JSON report.` }],
      schema: cropReportSchema,
      maxOutputTokens: 1500,
      models: VISION_MODELS,
    });
    const { data: saved, error } = await sb.from('disease_reports').insert({
      owner_id: auth.user.id,
      scan_id: scan.id,
      condition_name: report.condition_name,
      confidence: report.confidence,
      severity: report.severity,
      summary: report.summary,
      symptoms: report.symptoms,
      recommend_expert: report.recommend_expert || report.confidence === 'low' || report.severity === 'severe',
      raw_response: report,
    }).select().single();
    if (error) throw error;
    await sb.from('crop_scans').update({ status: 'completed' }).eq('id', scan.id);
    await sb.from('activity_logs').insert({ owner_id: auth.user.id, action: 'crop_scan', entity_type: 'crop_scan', entity_id: scan.id });
    return json(saved);
  } catch (e) {
    await sb.from('crop_scans').update({ status: 'failed' }).eq('id', scan.id);
    const code = e instanceof Error && ['ai_busy', 'ai_timeout', 'ai_blocked', 'ai_not_configured', 'image_missing'].includes(e.message) ? e.message : 'ai_failed';
    console.error('crop-scan', e);
    return fail(code, code === 'ai_busy' ? 429 : 502);
  }
});
