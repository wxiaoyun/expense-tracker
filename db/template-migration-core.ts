import { nextAvailableTemplateName, normalizeTemplateText, type TransactionType } from './template-core';

export type RecurringRowForTemplateMigration = {
  id: string;
  amount: number;
  description: string;
  category: string;
  startDate: number;
  lastCharged: number | null;
  recurrenceValue: string;
  createdAt: number;
  updatedAt: number;
};

export type MigratedTemplateRow = {
  id: string;
  name: string;
  normalizedName: string;
  amount: number | null;
  transactionType: TransactionType | null;
  description: string;
  category: string;
  notes: null;
  verified: null;
  recurrenceValue: string;
  startDate: number;
  scheduleCursorAt: number;
  scheduleActive: 0 | 1;
  deletedAt: null;
  createdAt: number;
  updatedAt: number;
};

const mapRecurringRow = (
  row: RecurringRowForTemplateMigration,
  activeNames: Set<string>,
): MigratedTemplateRow => {
  const baseName = row.description.trim() || `Template ${row.id}`;
  const name = nextAvailableTemplateName(baseName, [...activeNames]);
  const normalizedName = normalizeTemplateText(name);
  const isZeroAmount = row.amount === 0;
  activeNames.add(normalizedName);

  return {
    id: row.id,
    name,
    normalizedName,
    amount: isZeroAmount ? null : Math.abs(row.amount),
    transactionType: isZeroAmount ? null : row.amount > 0 ? 'income' : 'expense',
    description: row.description,
    category: row.category,
    notes: null,
    verified: null,
    recurrenceValue: row.recurrenceValue,
    startDate: row.startDate,
    scheduleCursorAt: row.lastCharged ?? row.startDate,
    scheduleActive: isZeroAmount ? 0 : 1,
    deletedAt: null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const mapRecurringRowsToTemplates = (
  rows: RecurringRowForTemplateMigration[],
  activeNames = new Set<string>(),
): MigratedTemplateRow[] => [...rows]
  .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
  .map((row) => mapRecurringRow(row, activeNames));
