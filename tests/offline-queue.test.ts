import { onlineManager } from '@tanstack/react-query';
import { saveRow } from '@/lib/query';

describe('offline-first inserts', () => {
  afterEach(() => onlineManager.setOnline(true));
  it('queues while offline and resolves right away', async () => {
    onlineManager.setOnline(false);
    const mutate = jest.fn(), queue = jest.fn();
    await expect(saveRow(mutate, queue, { table: 'animal_records', row: { value: 8 } })).resolves.toBe('queued');
    expect(queue).toHaveBeenCalledWith({ table: 'animal_records', row: { value: 8 } });
    expect(mutate).not.toHaveBeenCalled();
  });
  it('saves directly when online and surfaces errors', async () => {
    onlineManager.setOnline(true);
    const queue = jest.fn();
    await expect(saveRow(jest.fn().mockResolvedValue(null), queue, { table: 't', row: {} })).resolves.toBe('saved');
    await expect(saveRow(jest.fn().mockRejectedValue(new Error('rls')), queue, { table: 't', row: {} })).rejects.toThrow('rls');
    expect(queue).not.toHaveBeenCalled();
  });
});
