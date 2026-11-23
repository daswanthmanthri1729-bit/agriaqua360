import { useMutation } from '@tanstack/react-query';
import { OFFLINE_INSERT, OfflineRow, saveRow } from '@/lib/query';

/** Insert that works offline: returns 'saved' or 'queued' (sent automatically when back online). */
export function useOfflineInsert<V>(table: string, toRow: (v: V) => Record<string, unknown>) {
  const m = useMutation<unknown, Error, OfflineRow>({ mutationKey: OFFLINE_INSERT });
  return {
    isPending: m.isPending && !m.isPaused,
    mutateAsync: (v: V) => saveRow(m.mutateAsync, m.mutate, { table, row: toRow(v) }),
  };
}
