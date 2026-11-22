// Thin Gemini REST client (structured JSON output). Key never leaves the server.
const LANGS: Record<string, string> = { en: 'English', te: 'Telugu (తెలుగు script)', hi: 'Hindi (देवनागरी script)' };
export const languageName = (code: string) => LANGS[code] ?? 'English';

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

// Low thinking: default thinking took >45s on photo + schema prompts; low answers in ~4s with the same diagnosis.
// Primary model then fallback: Google retires/overloads models often (2.5-flash is closed to new keys, aliases hit 503s).
const MODELS = () => [Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash', 'gemini-3.8-flash'];
const RETRYABLE = new Set([404, 500, 503, 504]);

export async function generateJson<T>(opts: { system: string; parts: Part[]; schema: unknown; temperature?: number }): Promise<T> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('ai_not_configured');
  let last = 'ai_failed';
  for (const model of [...new Set(MODELS())]) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: AbortSignal.timeout(45_000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: opts.system }] },
          contents: [{ role: 'user', parts: opts.parts }],
          generationConfig: { temperature: opts.temperature ?? 0.3, responseMimeType: 'application/json', responseSchema: opts.schema, thinkingConfig: { thinkingLevel: 'low' } },
        }),
      });
    } catch {
      last = 'ai_timeout';
      continue;
    }
    if (res.status === 429) { last = 'ai_busy'; continue; }
    if (!res.ok) {
      console.error('gemini', model, res.status, (await res.text()).slice(0, 300));
      if (RETRYABLE.has(res.status)) { last = res.status === 503 ? 'ai_busy' : 'ai_failed'; continue; }
      throw new Error('ai_failed');
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
    if (!text) throw new Error(data?.promptFeedback?.blockReason ? 'ai_blocked' : 'ai_failed');
    return JSON.parse(text) as T;
  }
  throw new Error(last);
}

export function toBase64(bytes: Uint8Array) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
