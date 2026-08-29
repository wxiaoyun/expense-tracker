/** @jest-environment node */

jest.mock('@/db', () => ({ db: {} }));

import { categories, settings, transactionTemplates, transactions } from '../schema';
import { resetAllData, ResetDataError } from '../reset';

describe('reset all data', () => {
  afterEach(() => jest.restoreAllMocks());

  it('physically clears active and soft-deleted transactions and templates before categories and settings', async () => {
    const rows = new Map<unknown, Array<{ id: string; deletedAt?: number | null }>>([
      [transactions, [{ id: 'active-tx', deletedAt: null }, { id: 'deleted-tx', deletedAt: 10 }]],
      [transactionTemplates, [{ id: 'active-template', deletedAt: null }, { id: 'deleted-template', deletedAt: 20 }]],
      [categories, [{ id: 'category' }]],
      [settings, [{ id: 'setting' }]],
    ]);
    const deleteOrder: unknown[] = [];
    const database = {
      delete: (table: unknown) => ({
        run: async () => {
          deleteOrder.push(table);
          rows.set(table, []);
        },
      }),
    };

    await resetAllData(database);

    expect(deleteOrder).toEqual([transactions, transactionTemplates, categories, settings]);
    expect([...rows.values()].every((tableRows) => tableRows.length === 0)).toBe(true);
  });

  it('reports the table stage when a partial reset fails', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const database = {
      delete: (table: unknown) => ({
        run: async () => {
          if (table === transactionTemplates) throw new Error('forced delete failure');
        },
      }),
    };

    await expect(resetAllData(database)).rejects.toEqual(
      expect.objectContaining<Partial<ResetDataError>>({ stage: 'templates' }),
    );
    expect(error).toHaveBeenCalledWith(
      '[db.reset] reset partially failed',
      { stage: 'templates', error: 'Error: forced delete failure' },
    );
  });
});
