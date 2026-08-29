import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db, sqlite } from './index';
import { transactionTemplates } from './schema';
import type { NewTransaction } from './transaction';
import { getDueOccurrenceDates, templateOccurrenceId } from './recurrence-core';
import {
  mapRecurringToScheduledTemplate,
  mapScheduledTemplateToRecurring,
  type RecurringCompatibilityRow,
} from './recurring-compat-core';
import { createId } from '@/libs/id';

// Temporary compatibility API for existing recurring-rule callers while storage uses templates.
export type RecurringTransaction = RecurringCompatibilityRow;
export type NewRecurringTransaction = RecurringCompatibilityRow;

const activeSchedule = and(
  eq(transactionTemplates.scheduleActive, 1),
  isNull(transactionTemplates.deletedAt),
);

const getActiveTemplateNames = async (excludedId?: string): Promise<string[]> => {
  const rows = await db
    .select({ id: transactionTemplates.id, name: transactionTemplates.name })
    .from(transactionTemplates)
    .where(isNull(transactionTemplates.deletedAt))
    .all();
  return rows.filter(({ id }) => id !== excludedId).map(({ name }) => name);
};

export const getRecurringTransaction = async (id: string): Promise<RecurringTransaction | null> => {
  const result = await db
    .select()
    .from(transactionTemplates)
    .where(and(eq(transactionTemplates.id, id), activeSchedule))
    .get();
  return result ? mapScheduledTemplateToRecurring(result) : null;
};

export const listRecurringTransactions = async (query?: {
  categories?: string[];
}): Promise<RecurringTransaction[]> => {
  const { categories = [] } = query ?? {};
  const categoryFilter = categories.length > 0
    ? sql`${transactionTemplates.category} IN (${sql.join(categories.map((category) => sql`${category}`), sql`, `)})`
    : undefined;
  const rows = await db
    .select()
    .from(transactionTemplates)
    .where(and(activeSchedule, categoryFilter))
    .orderBy(desc(transactionTemplates.createdAt))
    .all();

  return rows
    .map(mapScheduledTemplateToRecurring)
    .filter((row): row is RecurringTransaction => row !== null);
};

export const createRecurringTransaction = async (
  transaction: Omit<NewRecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<RecurringTransaction | null> => {
  const now = Date.now();
  const id = createId();
  const recurring = { id, ...transaction, createdAt: now, updatedAt: now };
  const template = mapRecurringToScheduledTemplate(recurring, await getActiveTemplateNames());
  const result = await db.insert(transactionTemplates).values(template).run();

  return result.changes === 1 ? recurring : null;
};

export const updateRecurringTransaction = async (
  transaction: RecurringTransaction,
): Promise<RecurringTransaction | null> => {
  const now = Date.now();
  const updated = { ...transaction, updatedAt: now };
  const template = mapRecurringToScheduledTemplate(
    updated,
    await getActiveTemplateNames(transaction.id),
  );
  const result = await db
    .update(transactionTemplates)
    .set({
      name: template.name,
      normalizedName: template.normalizedName,
      amount: template.amount,
      transactionType: template.transactionType,
      category: template.category,
      description: template.description,
      recurrenceValue: template.recurrenceValue,
      startDate: template.startDate,
      scheduleCursorAt: template.scheduleCursorAt,
      scheduleActive: template.scheduleActive,
      updatedAt: now,
    })
    .where(eq(transactionTemplates.id, transaction.id))
    .run();

  return result.changes === 1 ? updated : null;
};

export const deleteRecurringTransaction = async (id: string): Promise<boolean> => {
  const result = await db
    .delete(transactionTemplates)
    .where(eq(transactionTemplates.id, id))
    .run();
  return result.changes > 0;
};

export const incurRecurringTransaction = async (id: string): Promise<number | null> => {
  const now = new Date();
  const recurring = await getRecurringTransaction(id);

  if (!recurring) {
    console.warn('[DB][incurRecurringTransaction] no recurring transaction');
    return null;
  }

  const lastCharged = new Date(recurring.lastCharged ?? recurring.startDate);
  const incurDates: Date[] = [];

  try {
    incurDates.push(...getDueOccurrenceDates(recurring.recurrenceValue, lastCharged, now));
  } catch (error) {
    console.error('[recurring][stage=parse_cron] failed to parse recurrence', {
      id,
      recurrenceValue: recurring.recurrenceValue,
      error: String(error),
    });
    return null;
  }

  if (incurDates.length === 0) {
    console.info(`[DB][incurRecurringTransaction] no transactions to create for recurring transaction ${id}`);
    return 0;
  }

  const toCreate = incurDates.map((date) => ({
    amount: recurring.amount,
    category: recurring.category,
    description: recurring.description,
    transactionDate: date.getTime(),
    templateId: recurring.id,
    deletedAt: null,
  } satisfies Omit<NewTransaction, 'id' | 'createdAt' | 'updatedAt' | 'verified' | 'notes'>));

  let incurred = 0;
  const lastDate = incurDates[incurDates.length - 1];
  try {
    await sqlite.withExclusiveTransactionAsync(async (transactionDb) => {
      const timestamp = Date.now();
      for (const transaction of toCreate) {
        const result = await transactionDb.runAsync(
          'INSERT OR IGNORE INTO transactions (id, amount, transaction_date, description, category, template_id, verified, notes, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?)',
          templateOccurrenceId(recurring.id, transaction.transactionDate),
          transaction.amount,
          transaction.transactionDate,
          transaction.description,
          transaction.category,
          recurring.id,
          timestamp,
          timestamp,
        );
        incurred += result.changes;
      }
      await transactionDb.runAsync(
        'UPDATE transaction_templates SET schedule_cursor_at = ?, updated_at = ? WHERE id = ?',
        lastDate.getTime(),
        timestamp,
        id,
      );
    });
  } catch (error) {
    console.error('[recurring][stage=commit_occurrences] atomic recurrence update failed', { id, error: String(error) });
    return null;
  }
  console.info('[recurring][stage=commit_occurrences] recurring transactions incurred', { id, incurred });
  return incurred;
};

export const incurAllRecurringTransactions = async (): Promise<{ id: string; incurred: number | null }[]> => {
  const all = await listRecurringTransactions();
  const results = [];
  for (const recurring of all) {
    const incurred = await incurRecurringTransaction(recurring.id);
    results.push({ id: recurring.id, incurred });
  }
  return results;
};
