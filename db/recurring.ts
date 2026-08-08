import { CronExpressionParser } from 'cron-parser';
import { and, between, desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { recurringTransactions, transactions } from "./schema";
import type { NewTransaction, Transaction } from "./transaction";
import { batchCreateTransactions } from "./transaction";
import { v4 as uuidv4 } from 'uuid';

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
  const id = uuidv4();
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
    const cronExp = CronExpressionParser.parse(rt.recurrenceValue, {
      currentDate: lastCharged,
    });

    for (
      let nextDate = cronExp.next().toDate();
      nextDate <= now;
      nextDate = cronExp.next().toDate()
    ) {
      incurDates.push(nextDate);
    }
  } catch (error) {
    console.error("[DB][incurRecurringTransaction] failed to parse cron:", error);
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

  const res = await batchCreateTransactions(toCreate);
  if (!res) {
    console.error(`[DB][incurRecurringTransaction] failed to create transactions for recurring transaction ${id}`);
    return null;
  }

  const incurred = toCreate.length;
  console.info("[DB][incurRecurringTransaction] total incurred %d, updated recurring transaction %o", incurred, rt);

  const lastDate = incurDates[incurDates.length - 1];
  const updated = await updateRecurringTransaction({
    ...rt,
    lastCharged: lastDate.getTime(),
  });

  if (!updated) {
    console.error(`[DB][incurRecurringTransaction] failed to update recurring transaction ${id}`);
    return null;
  }

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
