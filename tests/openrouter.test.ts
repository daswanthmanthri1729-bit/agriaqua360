import { jsonSchema, modelsFor, OR_TEXT, OR_VISION, parseLooseJson, toContent } from '../supabase/functions/_shared/openrouter';

describe('OpenRouter backup helpers', () => {
  it('only lists free models', () => {
    for (const m of [...OR_TEXT, ...OR_VISION]) expect(m.endsWith(':free') || m === 'openrouter/free').toBe(true);
  });
  it('picks models by input kind', () => {
    expect(modelsFor([{ text: 'hi' }])).toBe(OR_TEXT);
    expect(modelsFor([{ inline_data: { mime_type: 'image/jpeg', data: 'x' } }, { text: 'q' }])).toBe(OR_VISION);
    expect(modelsFor([{ inline_data: { mime_type: 'audio/mp4', data: 'x' } }])).toEqual([]);   // audio needs paid credit
  });
  it('converts Gemini schema types to JSON Schema', () => {
    expect(jsonSchema({ type: 'OBJECT', properties: { a: { type: 'ARRAY', items: { type: 'STRING' } } } }))
      .toBe('{"type":"object","properties":{"a":{"type":"array","items":{"type":"string"}}}}');
  });
  it('builds image and audio content parts', () => {
    const [img, aud] = toContent([{ inline_data: { mime_type: 'image/png', data: 'AA' } }, { inline_data: { mime_type: 'audio/mp4', data: 'BB' } }]);
    expect(img).toEqual({ type: 'image_url', image_url: { url: 'data:image/png;base64,AA' } });
    expect(aud).toEqual({ type: 'input_audio', input_audio: { data: 'BB', format: 'm4a' } });
  });
  it('extracts JSON from fenced or thinking output', () => {
    expect(parseLooseJson('<think>{"no":1}</think>```json\n{"answer":"ok","n":2}\n```')).toEqual({ answer: 'ok', n: 2 });
    expect(parseLooseJson('Sorry, I cannot help')).toBeNull();
    expect(parseLooseJson('[1,2]')).toBeNull();
  });
});
