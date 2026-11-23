// Backup AI: free models on OpenRouter, tried only after every Gemini model has failed or hit its quota.
// Only free models are listed (":free" IDs and the free router), so this never costs money (about 50 requests/day per key).
type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

// Owner's model plan (23 Nov 2026). Gemini stays first everywhere: these free models took 10–22 s per answer
// (Gemini: 1.5–5 s) and share a small daily quota, so they are the backup, in the owner's order per job.
// Reasoning, recommendations, market insights → Nemotron 3 Ultra, then ERNIE 5.5 Flash; crop photos → Nemotron 3.5
// Super VL, then Nemotron 3 Nano Omni; last resort → OpenRouter's free-model router.
export const OR_TEXT = ['nvidia/nemotron-3-ultra-550b-a55b:free', 'baidu/ernie-5.5-flash-preview:free', 'inclusionai/ling-3.2-flash:free', 'openrouter/free'];
export const OR_VISION = ['nvidia/nemotron-3.5-super-vl:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 'inclusionai/ling-3.2-flash:free', 'openrouter/free'];

/** Audio gets no backup: OpenRouter needs paid credit ($0.50 balance) for any audio input, even on free models. */
export function modelsFor(parts: Part[]): string[] {
  const mimes = parts.flatMap((p) => ('inline_data' in p ? [p.inline_data.mime_type] : []));
  return mimes.some((m) => m.startsWith('audio/')) ? [] : mimes.length ? OR_VISION : OR_TEXT;
}

/** Gemini's responseSchema uses upper-case types ("OBJECT"); JSON Schema wants lower case. */
export const jsonSchema = (schema: unknown) => JSON.stringify(schema).replace(/"type":"([A-Z]+)"/g, (_, t: string) => `"type":"${t.toLowerCase()}"`);

export function toContent(parts: Part[]) {
  return parts.map((p) => {
    if ('text' in p) return { type: 'text', text: p.text };
    const { mime_type: m, data } = p.inline_data;
    if (m.startsWith('audio/')) return { type: 'input_audio', input_audio: { data, format: m === 'audio/mp4' ? 'm4a' : m.split('/')[1] } };
    return { type: 'image_url', image_url: { url: `data:${m};base64,${data}` } };
  });
}

/** Free models do not all support strict JSON mode: take the outermost {...}, ignoring fences and thinking text. */
export function parseLooseJson(text: string): Record<string, unknown> | null {
  const s = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { const v = JSON.parse(s.slice(a, b + 1)); return v && typeof v === 'object' && !Array.isArray(v) ? v : null; } catch { return null; }
}

const hasRequired = (v: Record<string, unknown>, schema: unknown) =>
  ((schema as { required?: string[] })?.required ?? []).every((k) => v[k] !== undefined && v[k] !== null);

export async function openRouterJson<T>(opts: { system: string; parts: Part[]; schema: unknown; temperature?: number; maxOutputTokens?: number }): Promise<T> {
  // via globalThis: this file is also type-checked and unit-tested outside Deno
  const key = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get('OPENROUTER_API_KEY');
  if (!key) throw new Error('ai_not_configured');
  let last = 'ai_failed';
  for (const model of modelsFor(opts.parts)) {
    const t0 = Date.now();
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST', signal: AbortSignal.timeout(45_000),
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'AgriAqua 360' },
        body: JSON.stringify({
          model, temperature: opts.temperature ?? 0.3,
          max_tokens: (opts.maxOutputTokens ?? 1024) + 4096,   // reasoning models spend tokens thinking first
          reasoning: { effort: 'low' },
          messages: [
            { role: 'system', content: `${opts.system}\n\nReply with ONLY one JSON object (no markdown) that matches this JSON Schema:\n${jsonSchema(opts.schema)}` },
            { role: 'user', content: toContent(opts.parts) },
          ],
        }),
      });
      console.log(JSON.stringify({ ai: model, ms: Date.now() - t0, status: res.status }));
      if (!res.ok) { last = res.status === 429 ? 'ai_busy' : 'ai_failed'; continue; }
      const text: string = (await res.json())?.choices?.[0]?.message?.content ?? '';
      const v = parseLooseJson(text);
      if (v && hasRequired(v, opts.schema)) return v as T;
    } catch {
      console.log(JSON.stringify({ ai: model, ms: Date.now() - t0, status: 'timeout' }));
      last = 'ai_timeout';
    }
  }
  throw new Error(last);
}
