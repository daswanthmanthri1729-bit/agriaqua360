import { persistOptions } from '@/lib/query';

const q = (key: unknown[], status: string) => ({ queryKey: key, state: { status } }) as never;
const keep = persistOptions.dehydrateOptions!.shouldDehydrateQuery!;

it('persists successful data queries only, never expiring signed photo URLs', () => {
  expect(keep(q(['farms'], 'success'))).toBe(true);
  expect(keep(q(['weather', { lat: 1, lon: 2 }], 'success'))).toBe(true);
  expect(keep(q(['signed', 'media', 'u/scans/x.jpg'], 'success'))).toBe(false);
  expect(keep(q(['farms'], 'error'))).toBe(false);
  expect(keep(q(['farms'], 'pending'))).toBe(false);
});

it('keeps saved data for at most a day', () => expect(persistOptions.maxAge).toBe(24 * 3600_000));
