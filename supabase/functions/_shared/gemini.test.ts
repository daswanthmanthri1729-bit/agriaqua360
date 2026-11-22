// deno test --allow-env supabase/functions/_shared/gemini.test.ts
import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { _resetCooldowns, generateJson, modelOrder } from './gemini.ts';

Deno.env.set('GEMINI_API_KEY', 'test');
const ok = (obj: unknown) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), { status: 200 });
function mockFetch(byModel: Record<string, () => Response | Promise<Response>>) {
  const calls: string[] = [];
  globalThis.fetch = ((url: string) => {
    const m = String(url).match(/models\/([^:]+):/)![1];
    calls.push(m);
    return Promise.resolve(byModel[m]());
  }) as typeof fetch;
  return calls;
}
const opts = { system: 's', parts: [{ text: 'q' }], schema: {}, models: ['big', 'lite'] };

Deno.test('overloaded model falls back, then is skipped while cooling down', async () => {
  _resetCooldowns();
  const calls = mockFetch({ big: () => new Response('busy', { status: 503 }), lite: () => ok({ a: 1 }) });
  assertEquals(await generateJson(opts), { a: 1 });
  assertEquals(await generateJson(opts), { a: 1 });
  assertEquals(calls, ['big', 'lite', 'lite']); // second request did not wait on "big"
});

Deno.test('if every model is cooling down, the last one is still tried', () => {
  _resetCooldowns();
  assertEquals(modelOrder(['big', 'lite'], 0), ['big', 'lite']);
});

Deno.test('rate limit (429) and malformed JSON move to the next model', async () => {
  _resetCooldowns();
  const calls = mockFetch({ big: () => new Response('{"candidates":[{"content":{"parts":[{"text":"{bad"}]}}]}', { status: 200 }), lite: () => ok({ b: 2 }) });
  assertEquals(await generateJson(opts), { b: 2 });
  assertEquals(calls, ['big', 'lite']);
  _resetCooldowns();
  mockFetch({ big: () => new Response('', { status: 429 }), lite: () => new Response('', { status: 429 }) });
  await assertRejects(() => generateJson(opts), Error, 'ai_busy');
});

Deno.test('non-retryable error (400) stops immediately', async () => {
  _resetCooldowns();
  const calls = mockFetch({ big: () => new Response('bad request', { status: 400 }), lite: () => ok({}) });
  await assertRejects(() => generateJson(opts), Error, 'ai_failed');
  assertEquals(calls, ['big']);
});

Deno.test("429 honours Google's retryDelay (capped at 6 h), other errors cool for 60 s", async () => {
  const { cooldownFor } = await import('./gemini.ts');
  assertEquals(cooldownFor(429, '{"error":{"details":[{"retryDelay": "63962s"}]}}'), 6 * 3600_000);
  assertEquals(cooldownFor(429, '{"retryDelay":"30s"}'), 30_000);
  assertEquals(cooldownFor(429, '{"retryDelay":"0.5s"}'), 10_000);
  assertEquals(cooldownFor(503, ''), 60_000);
});

Deno.test('a model exhausted for the day is skipped on following requests', async () => {
  _resetCooldowns();
  const calls = mockFetch({ big: () => new Response('{"retryDelay":"63962s"}', { status: 429 }), lite: () => ok({ c: 3 }) });
  await generateJson(opts); await generateJson(opts); await generateJson(opts);
  assertEquals(calls, ['big', 'lite', 'lite', 'lite']);
});

Deno.test('partialJsonString decodes a string field while it is still being streamed', async () => {
  const { partialJsonString } = await import('./gemini.ts');
  assertEquals(partialJsonString('{"rep', 'reply'), '');
  assertEquals(partialJsonString('{"reply": "నా వరి', 'reply'), 'నా వరి');
  assertEquals(partialJsonString('{"reply":"a\\nb \\"c\\" \\u0C', 'reply'), 'a\nb "c" '); // cut inside \u escape
  assertEquals(partialJsonString('{"reply":"a\\u0C35b", "topic":"crop"}', 'reply'), 'aవb');
  assertEquals(partialJsonString('{"reply":"done\\', 'reply'), 'done'); // cut after backslash
});

Deno.test('streamJson emits growing text and returns the parsed object; fails over before first byte', async () => {
  _resetCooldowns();
  const { streamJson } = await import('./gemini.ts');
  const sse = (pieces: string[]) => new Response(pieces.map((p) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: p }] } }] })}\n\n`).join(''), { status: 200 });
  const calls = mockFetch({ big: () => new Response('', { status: 503 }), lite: () => sse(['{"reply":"Hel', 'lo farmer","topic":"crop"}']) });
  const seen: string[] = [];
  const out = await streamJson<{ reply: string; topic: string }>({ ...opts, streamField: 'reply' }, (t) => seen.push(t));
  assertEquals(calls, ['big', 'lite']);
  assertEquals(seen, ['Hel', 'Hello farmer']);
  assertEquals(out, { reply: 'Hello farmer', topic: 'crop' });
});
