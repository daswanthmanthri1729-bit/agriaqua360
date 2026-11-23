import { useState } from 'react';
import { ChoiceChips } from '@/components';
import { usePonds } from './api';

/** Selected pond (or ?pond= param) plus a chip picker when the farmer has more than one. */
export function usePondPick(initial?: string) {
  const ponds = usePonds();
  const [id, setId] = useState<string | null>(initial ?? null);
  const list = ponds.data ?? [];
  const pond = list.find((p) => p.id === id) ?? list[0];
  const picker = list.length > 1 ? <ChoiceChips scroll value={pond?.id ?? null} onChange={setId} options={list.map((p) => ({ value: p.id, label: p.name }))} /> : null;
  return { loading: ponds.isLoading, ponds: list, pond, picker };
}
