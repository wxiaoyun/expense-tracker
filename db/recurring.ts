import { and, between, desc, eq, sql } from "drizzle-orm";
import { db, sqlite } from "./index";
import { recurringTransactions, transactions } from "./schema";
import type { NewTransaction, Transaction } from "./transaction";
import { getDueOccurrenceDates, recurringOccurrenceId } from './recurrence-core';
import { createId } from '@/libs/id';

export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;

export const getRecurringTransaction = async (id: string): Promise<RecurringTransaction | null> => {
  const result = await db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.id, id))
    .get();
  return result ?? null;
};

export const listRecurringTransactions = async (query?: {
  categories?: string[];
}): Promise<RecurringTransaction[]> => {
  const { categories = [] } = query ?? {};

  if (categories.length > 0) {
    return db
      .select()
      .from(recurringTransactions)
      .where(sql`${recurringTransactions.category} IN (${sql.join(categories.map((c) => sql`${c}`), sql`, `)})`)
      .orderBy(desc(recurringTransactions.createdAt))
      .all();
  }

  return db
    .select()
    .from(recurringTransactions)
    .orderBy(desc(recurringTransactions.createdAt))
    .all();
};

export const createRecurringTransaction = async (
  transaction: Omit<NewRecurringTransaction, "id" | "createdAt" | "updatedAt">
): Promise<RecurringTransaction | null> => {
  const now = Date.now();
  const id = createId();
  const result = await db
    .insert(recurringTransactions)
    .values({
      ...transaction,
      id,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  if (result.changes === 1) {
    return {
      id,
      ...transaction,
      createdAt: now,
      updatedAt: now,
    } as RecurringTransaction;
  }
  return null;
};

export const updateRecurringTransaction = async (
  transaction: RecurringTransaction
): Promise<RecurringTransaction | null> => {
  const now = Date.now();
  const result = await db
    .update(recurringTransactions)
    .set({
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      startDate: transaction.startDate,
      lastCharged: transaction.lastCharged,
      recurrenceValue: transaction.recurrenceValue,
      updatedAt: now,
    })
    .where(eq(recurringTransactions.id, transaction.id))
    .run();

  if (result.changes === 1) {
    return { ...transaction, updatedAt: now };
  }
  return null;
};

export const deleteRecurringTransaction = async (id: string): Promise<boolean> => {
  const result = await db
    .delete(recurringTransactions)
    .where(eq(recurringTransactions.id, id))
    .run();
  return result.changes > 0;
};

export const incurRecurringTransaction = async (id: string): Promise<number | null> => {
  const now = new Date();
  const rt = await getRecurringTransaction(id);

  if (!rt) {
    console.warn("[DB][incurRecurringTransaction] no recurring transaction");
    return null;
  }

  const lastCharged = new Date(rt.lastCharged ?? rt.startDate);
  const incurDates: Date[] = [];

  try {
    incurDates.push(...getDueOccurrenceDates(rt.recurrenceValue, lastCharged, now));
  } catch (error) {
    console.error('[recurring][stage=parse_cron] failed to parse recurrence', {
      id,
      recurrenceValue: rt.recurrenceValue,
      error: String(error),
    });
    return null;
  }

  if (incurDates.length === 0) {
    console.info(`[DB][incurRecurringTransaction] no transactions to create for recurring transaction ${id}`);
    return 0;
  }

  const toCreate = incurDates.map(
    (date) =>
      ({
        amount: rt.amount,
        category: rt.category,
        description: rt.description,
        transactionDate: date.getTime(),
        recurringTransactionId: rt.id,
      }) as Omit<NewTransaction, "id" | "createdAt" | "updatedAt" | "id" | "verified" | "notes">
  );

  let incurred = 0;
  const lastDate = incurDates[incurDates.length - 1];
  try {
    await sqlite.withExclusiveTransactionAsync(async (transactionDb) => {
      const timestamp = Date.now();
      for (const transaction of toCreate) {
        const result = await transactionDb.runAsync(
          'INSERT OR IGNORE INTO transactions (id, amount, transaction_date, description, category, recurring_transaction_id, verified, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)',
          recurringOccurrenceId(rt.id, transaction.transactionDate), transaction.amount, transaction.transactionDate, transaction.description, transaction.category, rt.id, timestamp, timestamp,
        );
        incurred += result.changes;
      }
      await transactionDb.runAsync('UPDATE recurring_transactions SET last_charged = ?, updated_at = ? WHERE id = ?', lastDate.getTime(), timestamp, id);
    });
  } catch (error) {
    console.error('[recurring][stage=commit_occurrences] atomic recurrence update failed', { id, error: String(error) });
    return null;
  }
  console.info('[recurring][stage=commit_occurrences] recurring transactions incurred', { id, incurred });
  return incurred;
};

export const incurAllRecurringTransactions = async (): Promise<{ id: string; incurred: number | null }[]> => {
  const all = await db.select().from(recurringTransactions).all();
  const results = [];
  for (const rt of all) {
    const incurred = await incurRecurringTransaction(rt.id);
    results.push({ id: rt.id, incurred });
  }
  return results;
};
