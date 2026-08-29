import { nextAvailableTemplateName, normalizeTemplateText } from './template-core';

export type RecurringCompatibilityRow = {
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

export type ScheduledTemplateSource = {
  id: string;
  amount: number | null;
  transactionType: 'income' | 'expense' | null;
  description: string | null;
  category: string | null;
  startDate: number | null;
  scheduleCursorAt: number | null;
  recurrenceValue: string | null;
  createdAt: number;
  updatedAt: number;
};

export const mapScheduledTemplateToRecurring = (
  template: ScheduledTemplateSource,
): RecurringCompatibilityRow | null => {
  if (
    template.amount === null ||
    template.transactionType === null ||
    template.description === null ||
    template.category === null ||
    template.startDate === null ||
    template.recurrenceValue === null
  ) {
    return null;
  }

  const magnitude = Math.abs(template.amount);
  return {
    id: template.id,
    amount: template.transactionType === 'income' ? magnitude : -magnitude,
    description: template.description,
    category: template.category,
    startDate: template.startDate,
    lastCharged: template.scheduleCursorAt,
    recurrenceValue: template.recurrenceValue,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
};

export const mapRecurringToScheduledTemplate = (
  recurring: RecurringCompatibilityRow,
  activeNames: string[],
) => {
  const magnitude = Math.abs(recurring.amount);
  if (!Number.isFinite(magnitude) || magnitude <= 0) {
    throw new Error('Amount must be greater than zero');
  }

  const baseName = recurring.description.trim() || `Template ${recurring.id}`;
  const name = nextAvailableTemplateName(baseName, activeNames);

  return {
    id: recurring.id,
    name,
    normalizedName: normalizeTemplateText(name),
    amount: magnitude,
    transactionType: recurring.amount >= 0 ? 'income' as const : 'expense' as const,
    description: recurring.description,
    category: recurring.category,
    notes: null,
    verified: null,
    recurrenceValue: recurring.recurrenceValue,
    startDate: recurring.startDate,
    scheduleCursorAt: recurring.lastCharged ?? recurring.startDate,
    scheduleActive: 1,
    deletedAt: null,
    createdAt: recurring.createdAt,
    updatedAt: recurring.updatedAt,
  };
};
