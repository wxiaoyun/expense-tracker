import { validateOccurrence } from '@/libs/date';
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
  const amountMagnitude = Math.abs(row.amount);
  const amountIsValid = Number.isFinite(amountMagnitude) && amountMagnitude > 0;
  const scheduleCursorAt = row.lastCharged ?? row.startDate;
  const startIsValid = Number.isFinite(row.startDate) && Number.isInteger(row.startDate);
  const cursorIsValid = Number.isFinite(scheduleCursorAt)
    && Number.isInteger(scheduleCursorAt)
    && scheduleCursorAt >= row.startDate;
  const recurrenceIsValid = typeof row.recurrenceValue === 'string'
    && row.recurrenceValue.trim().length > 0
    && validateOccurrence(row.recurrenceValue).ok;
  const scheduleIsComplete = amountIsValid
    && row.description.trim().length > 0
    && startIsValid
    && cursorIsValid
    && recurrenceIsValid;
  activeNames.add(normalizedName);

  return {
    id: row.id,
    name,
    normalizedName,
    amount: amountIsValid ? amountMagnitude : null,
    transactionType: amountIsValid ? row.amount > 0 ? 'income' : 'expense' : null,
    description: row.description,
    category: row.category,
    notes: null,
    verified: null,
    recurrenceValue: row.recurrenceValue,
    startDate: row.startDate,
    scheduleCursorAt,
    scheduleActive: scheduleIsComplete ? 1 : 0,
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
