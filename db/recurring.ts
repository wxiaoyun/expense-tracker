import { CronExpressionParser } from 'cron-parser';
import { and, between, desc, eq, inArray } from "drizzle-orm";
import { db } from "./index";
import { recurringTransactions, transactions } from "./schema";
import type { NewTransaction, Transaction } from "./transaction";
import { batchCreateTransactions } from "./transaction";


export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;

export const getRecurringTransaction = async (id: number): Promise<RecurringTransaction | null> => {
  const result = await db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.id, id))
    .get();
  return result ?? null;
};

export const listRecurringTransactions = async (query?: {
  start?: Date;
  end?: Date;
  categories?: string[];
}): Promise<RecurringTransaction[]> => {
  const { start, end, categories = [] } = query ?? {};
  const startDate = start?.getTime() ?? 0;
  const endDate = end?.getTime() ?? Number.MAX_SAFE_INTEGER;

  let whereConditions = [between(recurringTransactions.startDate, startDate, endDate)];

  if (categories.length > 0) {
    whereConditions.push(inArray(recurringTransactions.category, categories));
  }

  const result = await db
    .select()
    .from(recurringTransactions)
    .where(and(...whereConditions))
    .orderBy(desc(recurringTransactions.createdAt))
    .all();

  return result;
};

export const createRecurringTransaction = async (
  transaction: Omit<NewRecurringTransaction, "id" | "createdAt" | "updatedAt">
): Promise<RecurringTransaction | null> => {
  const now = Date.now();
  const result = await db
    .insert(recurringTransactions)
    .values({
      ...transaction,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  if (result.lastInsertRowId && result.changes === 1) {
    return {
      id: result.lastInsertRowId,
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

export const deleteRecurringTransaction = async (id: number): Promise<boolean> => {
  const result = await db
    .delete(recurringTransactions)
    .where(eq(recurringTransactions.id, id))
    .run();
  return result.changes > 0;
};

export const incurRecurringTransaction = async (id: number): Promise<number | null> => {
  const now = new Date();
  const rt = await getRecurringTransaction(id);

  if (!rt) {
    console.warn("[DB][incurRecurringTransaction] no recurring transaction");
    return null;
  }

  const lastCharged = new Date(rt.lastCharged ?? rt.startDate);
  const incurDates: Date[] = [];

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

  if (incurDates.length === 0) {
    console.info(
      `[DB][incurRecurringTransaction] no transactions to create for recurring transaction ${id}`,
    );
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
      }) as Omit<NewTransaction, "id" | "createdAt" | "updatedAt">
  );

  const res = await batchCreateTransactions(toCreate);
  if (!res) {
    console.error(
      `[DB][incurRecurringTransaction] failed to create transactions for recurring transaction ${id}`,
    );
    return null;
  }

  const incurred = toCreate.length;

  console.info(
    "[DB][incurRecurringTransaction] total incurred %d, updated recurring transaction %o",
    incurred,
    rt,
  );

  const lastDate = incurDates[incurDates.length - 1];
  const updated = await updateRecurringTransaction({
    ...rt,
    lastCharged: lastDate.getTime(),
  });

  if (!updated) {
    console.error(
      `[DB][incurRecurringTransaction] failed to update recurring transaction ${id}`,
    );
    return null;
  }

  return incurred;
};

export const listTransactionsByRecurringTransactionId = async (id: number): Promise<Transaction[]> => {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.recurringTransactionId, id))
    .all();
  return result;
};

export const batchCreateRecurringTransactions = async (
  txs: Omit<NewRecurringTransaction, "id" | "createdAt" | "updatedAt">[]
): Promise<boolean> => {
  if (txs.length === 0) {
    return false;
  }

  const now = Date.now();
  const values = txs.map((tx) => ({
    ...tx,
    createdAt: now,
    updatedAt: now,
  }));

  const result = await db.insert(recurringTransactions).values(values).run();
  return result.changes === values.length;
};

export const clearRecurringTransactions = async (): Promise<boolean> => {
  const result = await db.delete(recurringTransactions).run();
  return result.changes > 0;
};

export const listCategories = async (): Promise<string[]> => {
  const rows = await db
    .selectDistinct({ category: recurringTransactions.category })
    .from(recurringTransactions)
    .all();
  return rows.map((r) => r.category);
};
