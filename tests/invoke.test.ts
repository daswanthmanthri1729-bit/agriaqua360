const mockInvoke = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => mockInvoke(...a) } } }));
import { invoke } from '@/lib/query';

// Server error codes must reach the farmer as their own translated message, not "no internet".
it('maps Edge Function error codes to errors.<code>', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: { context: new Response('{"error":"ai_busy"}', { status: 429 }) } });
  await expect(invoke('crop-scan', { scan_id: 'x' })).rejects.toThrow('errors.ai_busy');
});

it('falls back to a network error when there is no server response', async () => {
  mockInvoke.mockResolvedValue({ data: null, error: new Error('Failed to send a request') });
  await expect(invoke('weather', { lat: 1, lon: 2 })).rejects.toThrow('errors.network');
});

it('returns data on success', async () => {
  mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
  await expect(invoke('weather', { city: 'Eluru,IN' })).resolves.toEqual({ ok: true });
});
