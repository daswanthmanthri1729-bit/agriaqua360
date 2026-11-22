// Thin Gemini REST client (structured JSON output). Key never leaves the server.
const LANGS: Record<string, string> = { en: 'English', te: 'Telugu (తెలుగు script)', hi: 'Hindi (देवनागरी script)' };
export const languageName = (code: string) => LANGS[code] ?? 'English';

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

// Low thinking: default thinking took >45 s on photo + schema prompts; low answers in ~4 s with the same diagnosis.
// Routing (measured 22 Nov 2026): the key is on Google's free tier — every model has its OWN daily quota
// (gemini-3.5-flash: 20 requests/day) and the bigger models are often overloaded (503 / 40 s hangs), while
// gemini-3.1-flash-lite answered every call in 1.5–5 s with correct Telugu. So: spread work across models,
// honour Google's retry delay, and remember failures per server instance.
export const CHAT_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash'];
export const VISION_MODELS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']; // accuracy first, owner-approved lite fallback
export const FAST_MODELS = CHAT_MODELS;
const DEFAULT_MODELS = CHAT_MODELS;
const COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 6 * 3600_000;
const FIRST_TRY_MS = 15_000;
const LAST_TRY_MS = 30_000;
const RETRYABLE = new Set([404, 429, 500, 503, 504]);
const coolingUntil = new Map<string, number>(); // model → time it may be tried again (per instance)

export function modelOrder(models: string[], now = Date.now()) {
  const ready = models.filter((m) => (coolingUntil.get(m) ?? 0) <= now);
  // Never end up with nothing: if every model is cooling down, still try the last (most available) one.
  return ready.length ? ready : models.slice(-1);
}
export const _resetCooldowns = () => coolingUntil.clear();

/** 429s carry Google's RetryInfo ("63962s" when a daily quota is used up): skip the model that long (capped). */
export function cooldownFor(status: number, body: string): number {
  if (status !== 429) return COOLDOWN_MS;
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.min(MAX_COOLDOWN_MS, Math.max(10_000, Number(m[1]) * 1000)) : COOLDOWN_MS;
}

type Opts = { system: string; parts: Part[]; schema: unknown; temperature?: number; maxOutputTokens?: number; models?: string[] };

export async function generateJson<T>(opts: Opts): Promise<T> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('ai_not_configured');
  const configured = Deno.env.get('GEMINI_MODELS')?.split(',').map((m) => m.trim()).filter(Boolean);
  const order = modelOrder(opts.models ?? configured ?? DEFAULT_MODELS);
  let last = 'ai_failed';
  for (const [i, model] of order.entries()) {
    const t0 = Date.now();
    const isLast = i === order.length - 1;
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(isLast ? LAST_TRY_MS : FIRST_TRY_MS),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: opts.parts }],
          generationConfig: {
            temperature: opts.temperature ?? 0.3, maxOutputTokens: opts.maxOutputTokens ?? 1024,
            responseMimeType: 'application/json', responseSchema: opts.schema, thinkingConfig: { thinkingLevel: 'low' },
          },
        }),
      });
    } catch {
      coolingUntil.set(model, Date.now() + COOLDOWN_MS);
      console.log(JSON.stringify({ ai: model, ms: Date.now() - t0, status: 'timeout' }));
      last = 'ai_timeout';
      continue;
    }
    console.log(JSON.stringify({ ai: model, ms: Date.now() - t0, status: res.status }));
    if (!res.ok) {
      const raw = await res.text();
      const detail = raw.slice(0, 200);
      if (RETRYABLE.has(res.status)) {
        coolingUntil.set(model, Date.now() + cooldownFor(res.status, raw));
        last = res.status === 503 || res.status === 429 ? 'ai_busy' : 'ai_failed';
        continue;
      }
      console.error('gemini', model, res.status, detail);
      throw new Error('ai_failed');
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
    if (!text) throw new Error(data?.promptFeedback?.blockReason ? 'ai_blocked' : 'ai_failed');
    try {
      return JSON.parse(text) as T;
    } catch {
      last = 'ai_failed'; // truncated / malformed JSON: try the next model
      continue;
    }
  }
  throw new Error(last);
}

export function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
