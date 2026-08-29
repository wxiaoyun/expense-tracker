/** @jest-environment node */

import { mapRecurringRowsToTemplates } from '../template-migration-core';

describe('template migration core', () => {
  it('preserves ids and suffixes duplicate migrated names', () => {
    expect(mapRecurringRowsToTemplates([
      { id: 'b', amount: -20, description: 'Netflix', category: 'Bills', startDate: 2, lastCharged: null, recurrenceValue: '0 0 1 * *', createdAt: 2, updatedAt: 2 },
      { id: 'a', amount: -10, description: ' netflix ', category: 'Bills', startDate: 1, lastCharged: 3, recurrenceValue: '0 0 1 * *', createdAt: 1, updatedAt: 1 },
    ]).map((row) => ({ id: row.id, name: row.name, normalizedName: row.normalizedName }))).toEqual([
      { id: 'a', name: 'netflix', normalizedName: 'netflix' },
      { id: 'b', name: 'Netflix 2', normalizedName: 'netflix 2' },
    ]);
  });

  it('uses preserved ids for deterministic nonempty fallback names', () => {
    expect(mapRecurringRowsToTemplates([
      { id: 'rule-b', amount: -20, description: ' \t ', category: 'Bills', startDate: 2, lastCharged: null, recurrenceValue: '0 0 1 * *', createdAt: 2, updatedAt: 2 },
      { id: 'rule-a', amount: -10, description: '   ', category: 'Bills', startDate: 1, lastCharged: null, recurrenceValue: '0 0 1 * *', createdAt: 1, updatedAt: 1 },
    ]).map(({ id, name, normalizedName, description }) => ({ id, name, normalizedName, description }))).toEqual([
      { id: 'rule-a', name: 'Template rule-a', normalizedName: 'template rule-a', description: '   ' },
      { id: 'rule-b', name: 'Template rule-b', normalizedName: 'template rule-b', description: ' \t ' },
    ]);
  });

  it('pauses zero-valued source schedules without dropping their data', () => {
    expect(mapRecurringRowsToTemplates([
      { id: 'zero', amount: 0, description: 'Legacy zero', category: 'Other', startDate: 10, lastCharged: 20, recurrenceValue: '0 0 1 * *', createdAt: 1, updatedAt: 2 },
    ])).toEqual([
      expect.objectContaining({
        id: 'zero',
        amount: null,
        transactionType: null,
        description: 'Legacy zero',
        category: 'Other',
        recurrenceValue: '0 0 1 * *',
        startDate: 10,
        scheduleCursorAt: 20,
        scheduleActive: 0,
      }),
    ]);
  });

  it('stores positive magnitudes and preserves scheduling state', () => {
    expect(mapRecurringRowsToTemplates([
      { id: 'income', amount: 100, description: 'Salary', category: 'Income', startDate: 10, lastCharged: 20, recurrenceValue: '0 0 1 * *', createdAt: 1, updatedAt: 2 },
      { id: 'expense', amount: -25, description: 'Gym', category: 'Health', startDate: 30, lastCharged: null, recurrenceValue: '0 0 1 * *', createdAt: 3, updatedAt: 4 },
    ])).toEqual([
      expect.objectContaining({
        id: 'income',
        amount: 100,
        transactionType: 'income',
        scheduleCursorAt: 20,
        scheduleActive: 1,
      }),
      expect.objectContaining({
        id: 'expense',
        amount: 25,
        transactionType: 'expense',
        scheduleCursorAt: 30,
        scheduleActive: 1,
      }),
    ]);
  });
});
