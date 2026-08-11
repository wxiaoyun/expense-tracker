export type SummaryInput = { amount: number; transactionDate: number; category: string };

export function aggregateSummaryRows(rows: SummaryInput[]) {
  const categoryTotals = new Map<string, number>();
  const monthTotals = new Map<string, number>();

  for (const row of rows) {
    if (row.amount >= 0) continue;
    const expense = Math.abs(row.amount);
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + expense);
    const date = new Date(row.transactionDate);
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    monthTotals.set(month, (monthTotals.get(month) ?? 0) + expense);
  }

  return {
    categories: [...categoryTotals].map(([category, expense]) => ({ category, expense })),
    months: [...monthTotals].sort(([a], [b]) => a.localeCompare(b)).map(([month, expense]) => ({ month, expense })),
  };
}
