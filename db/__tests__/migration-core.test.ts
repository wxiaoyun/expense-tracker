/** @jest-environment node */

import {
  generateMigrationUUID,
  mapLegacyRecurring,
  mapLegacyTransaction,
  splitIntoMigrationBatches,
} from '../migration-core';

describe('migration core', () => {
  it('maps legacy IDs to stable UUIDs', () => {
    expect(generateMigrationUUID(42)).toBe(generateMigrationUUID(42));
    expect(generateMigrationUUID(42)).not.toBe(generateMigrationUUID(43));
    expect(generateMigrationUUID(42)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('maps every legacy transaction field and recurring reference', () => {
    expect(mapLegacyTransaction({
      id: 7,
      amount: -12.5,
      transaction_date: 1700000000000,
      description: 'Lunch',
      category: 'Food',
      recurring_transaction_id: 3,
      verified: 1,
      created_at: 1700000000001,
      updated_at: 1700000000002,
    })).toEqual({
      id: generateMigrationUUID(7),
      amount: -12.5,
      transactionDate: 1700000000000,
      description: 'Lunch',
      category: 'Food',
      recurringTransactionId: generateMigrationUUID(3),
      verified: 1,
      notes: null,
      createdAt: 1700000000001,
      updatedAt: 1700000000002,
    });
  });

  it('maps nullable recurring fields', () => {
    expect(mapLegacyRecurring({
      id: 9,
      amount: -99,
      description: 'Internet',
      category: 'Bills',
      start_date: 1700000000000,
      last_charged: null,
      recurrence_value: '0 0 1 * *',
      created_at: 1700000000001,
      updated_at: 1700000000002,
    })).toEqual(expect.objectContaining({
      id: generateMigrationUUID(9),
      lastCharged: null,
      recurrenceValue: '0 0 1 * *',
    }));
  });

  it('preserves all 2,246 rows across 1,000-row batches', () => {
    const rows = Array.from({ length: 2246 }, (_, index) => index + 1);
    const batches = splitIntoMigrationBatches(rows, 1000);

    expect(batches.map((batch) => batch.length)).toEqual([1000, 1000, 246]);
    expect(batches.flat()).toEqual(rows);
  });
});
