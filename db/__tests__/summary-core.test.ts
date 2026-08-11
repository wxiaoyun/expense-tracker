import { aggregateSummaryRows } from '../summary-core';

describe('aggregateSummaryRows', () => {
  it('aggregates 2,246 rows without losing records', () => {
    const rows = Array.from({ length: 2246 }, (_, index) => ({
      amount: -1,
      transactionDate: Date.UTC(2026, index % 12, 1),
      category: index % 2 ? 'Food' : 'Bills',
    }));
    const result = aggregateSummaryRows(rows);
    expect(result.categories.reduce((sum, row) => sum + row.expense, 0)).toBe(2246);
    expect(result.months.reduce((sum, row) => sum + row.expense, 0)).toBe(2246);
    expect(result.months).toHaveLength(12);
  });

  it('excludes income from expense charts', () => {
    expect(aggregateSummaryRows([{ amount: 20, transactionDate: 0, category: 'Income' }]))
      .toEqual({ categories: [], months: [] });
  });
});
