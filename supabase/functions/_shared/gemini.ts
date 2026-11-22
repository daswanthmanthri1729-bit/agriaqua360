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
  if (ready.length) return ready;
  // Everything is resting: try the one whose rest ends soonest (a per-minute limit, not a daily one).
  return [models.reduce((a, b) => ((coolingUntil.get(b) ?? 0) < (coolingUntil.get(a) ?? 0) ? b : a))];
}
export const _resetCooldowns = () => coolingUntil.clear();

/** 429s carry Google's RetryInfo ("63962s" when a daily quota is used up): skip the model that long (capped). */
export function cooldownFor(status: number, body: string): number {
  if (status !== 429) return COOLDOWN_MS;
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return m ? Math.min(MAX_COOLDOWN_MS, Math.max(10_000, Number(m[1]) * 1000)) : COOLDOWN_MS;
}

// thinking 'minimal' answers chat in ~1 s (measured) with the same advice; diagnosis keeps 'low'.
type Opts = { system: string; parts: Part[]; schema: unknown; temperature?: number; maxOutputTokens?: number; models?: string[]; thinking?: 'minimal' | 'low' };

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
            responseMimeType: 'application/json', responseSchema: opts.schema, thinkingConfig: { thinkingLevel: opts.thinking ?? 'low' },
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

/** Decoded prefix of a JSON string field inside an incomplete JSON document (streaming). '' until the field starts. */
export function partialJsonString(buf: string, key: string): string {
  const m = new RegExp(`"${key}"\\s*:\\s*"`).exec(buf);
  if (!m) return '';
  let out = '';
  for (let i = m.index + m[0].length; i < buf.length; i++) {
    const c = buf[i];
    if (c === '"') return out;
    if (c !== '\\') { out += c; continue; }
    const n = buf[i + 1];
    if (n === undefined) return out; // escape cut off mid-stream
    if (n === 'u') {
      const hex = buf.slice(i + 2, i + 6);
      if (hex.length < 4) return out;
      out += String.fromCharCode(parseInt(hex, 16)); i += 5; continue;
    }
    out += ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' } as Record<string, string>)[n] ?? n; i++;
  }
  return out;
}

/**
 * Same routing as generateJson, but streams: onText gets the growing value of `streamField` as Gemini writes it.
 * Failover only happens before the first chunk; after that a failure is reported, not retried.
 */
export async function streamJson<T>(opts: Opts & { streamField: string }, onText: (text: string) => void): Promise<T> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('ai_not_configured');
  const order = modelOrder(opts.models ?? DEFAULT_MODELS);
  let last = 'ai_failed';
  for (const [i, model] of order.entries()) {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), i === order.length - 1 ? LAST_TRY_MS : FIRST_TRY_MS); // time to first byte
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: opts.parts }],
          generationConfig: {
            temperature: opts.temperature ?? 0.3, maxOutputTokens: opts.maxOutputTokens ?? 1024,
            responseMimeType: 'application/json', responseSchema: opts.schema, thinkingConfig: { thinkingLevel: opts.thinking ?? 'low' },
          },
        }),
      });
    } catch {
      clearTimeout(timer);
      coolingUntil.set(model, Date.now() + COOLDOWN_MS);
      console.log(JSON.stringify({ ai: model, stream: true, ms: Date.now() - t0, status: 'timeout' }));
      last = 'ai_timeout';
      continue;
    }
    clearTimeout(timer);
    if (!res.ok || !res.body) {
      const raw = await res.text();
      console.log(JSON.stringify({ ai: model, stream: true, ms: Date.now() - t0, status: res.status }));
      if (RETRYABLE.has(res.status)) { coolingUntil.set(model, Date.now() + cooldownFor(res.status, raw)); last = res.status === 503 || res.status === 429 ? 'ai_busy' : 'ai_failed'; continue; }
      throw new Error('ai_failed');
    }
    let json = '', sent = '', pending = '', firstMs = 0;
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += value;
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const chunk = JSON.parse(line.slice(5));
        json += chunk?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
        const text = partialJsonString(json, opts.streamField);
        if (text.length > sent.length) { if (!firstMs) firstMs = Date.now() - t0; sent = text; onText(text); }
      }
    }
    console.log(JSON.stringify({ ai: model, stream: true, firstMs, ms: Date.now() - t0, status: 200 }));
    try { return JSON.parse(json) as T; } catch {
      // Google sometimes ends a stream early under load; rest this model and let the caller fall back.
      coolingUntil.set(model, Date.now() + COOLDOWN_MS);
      throw new Error('ai_stream_incomplete');
    }
  }
  throw new Error(last);
}
