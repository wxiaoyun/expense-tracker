import { and, between, desc, eq, inArray, sql, sum, asc } from "drizzle-orm";
import { db } from "./index";
import { transactions } from "./schema";
import { createId } from '@/libs/id';

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export const getTransaction = async (id: string): Promise<Transaction | null> => {
  const result = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))
    .get();
  return result ?? null;
};

export const listTransactions = async (query?: {
  start?: Date;
  end?: Date;
  limit?: number;
  offset?: number;
  orderBy?: [string, "ASC" | "DESC"];
  categories?: string[];
  verified?: number;
  search?: string;
}): Promise<{ items: Transaction[]; nextOffset: number | null }> => {
  const {
    start = new Date(0),
    end = new Date(Number.MAX_SAFE_INTEGER),
    limit = 50,
    offset = 0,
    orderBy = ["transactionDate", "DESC"],
    categories = [],
    verified,
    search,
  } = query ?? {};

  const startTs = start.getTime();
  const endTs = end.getTime();
  const [orderKey, orderDir] = orderBy;
  
  const getOrderColumn = (key: string) => {
    switch (key) {
      case "transactionDate": return transactions.transactionDate;
      case "amount": return transactions.amount;
      case "category": return transactions.category;
      case "description": return transactions.description;
      case "createdAt": return transactions.createdAt;
      case "updatedAt": return transactions.updatedAt;
      default: return transactions.transactionDate;
    }
  };

  const orderColumn = getOrderColumn(orderKey);
  const orderDirection = orderDir === "DESC" ? desc(orderColumn) : asc(orderColumn);

  let whereConditions = [between(transactions.transactionDate, startTs, endTs)];
  
  if (categories.length) {
    whereConditions.push(sql`${transactions.category} IN (${sql.join(categories.map((c) => sql`${c}`), sql`, `)})`);
  }
  if (verified !== undefined) {
    whereConditions.push(eq(transactions.verified, verified ? 1 : 0));
  }
  if (search) {
    whereConditions.push(sql`${transactions.description} LIKE ${`%${search}%`}`);
  }

  const items = await db
    .select()
    .from(transactions)
    .where(and(...whereConditions))
    .orderBy(orderDirection)
    .limit(limit)
    .offset(offset)
    .all();

  const nextOffset = items.length < limit ? null : offset + limit;
  return { items, nextOffset };
};

export const summarizeTransactions = async (query?: {
  start?: Date;
  end?: Date;
  categories?: string[];
  verified?: number;
}): Promise<{ balance: number; income: number; expense: number } | null> => {
  const { start, end, categories = [], verified } = query ?? {};
  const startTs = start?.getTime() ?? 0;
  const endTs = end?.getTime() ?? Number.MAX_SAFE_INTEGER;

  let whereConditions = [between(transactions.transactionDate, startTs, endTs)];
  
  if (categories.length) {
    whereConditions.push(sql`${transactions.category} IN (${sql.join(categories.map((c) => sql`${c}`), sql`, `)})`);
  }
  if (verified !== undefined) {
    whereConditions.push(eq(transactions.verified, verified ? 1 : 0));
  }

  const row = await db
    .select({
      balance: sum(transactions.amount),
      income: sum(sql<number>`CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END`),
      expense: sum(sql<number>`CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END`),
    })
    .from(transactions)
    .where(and(...whereConditions))
    .get();

  if (!row) return null;
  return {
    balance: Number(row.balance ?? 0),
    income: Number(row.income ?? 0),
    expense: Number(row.expense ?? 0),
  };
};

export const createTransaction = async (
  transaction: Omit<NewTransaction, "id" | "createdAt" | "updatedAt">
): Promise<Transaction | null> => {
  const now = Date.now();
  const id = createId();
  const result = await db
    .insert(transactions)
    .values({
      ...transaction,
      id,
      verified: transaction.verified ?? 0,
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
    } as Transaction;
  }
  return null;
};

export const updateTransaction = async (
  transaction: Transaction
): Promise<Transaction | null> => {
  const now = Date.now();
  const result = await db
    .update(transactions)
    .set({
      amount: transaction.amount,
      transactionDate: transaction.transactionDate,
      category: transaction.category,
      description: transaction.description,
      recurringTransactionId: transaction.recurringTransactionId,
      verified: transaction.verified ?? 0,
      notes: transaction.notes,
      updatedAt: now,
    })
    .where(eq(transactions.id, transaction.id))
    .run();

  if (result.changes === 1) {
    return { ...transaction, updatedAt: now };
  }
  return null;
};

export const deleteTransaction = async (id: string): Promise<boolean> => {
  const result = await db.delete(transactions).where(eq(transactions.id, id)).run();
  return result.changes > 0;
};

export const listCategories = async (): Promise<string[]> => {
  const rows = await db
    .selectDistinct({ category: transactions.category })
    .from(transactions)
    .all();
  return rows.map((r) => r.category);
};

export const clearTransactions = async (): Promise<void> => {
  await db.delete(transactions).run();
};

export const batchCreateTransactions = async (
  txs: Omit<NewTransaction, "id" | "createdAt" | "updatedAt">[]
): Promise<boolean> => {
  if (!txs.length) return false;
  const now = Date.now();
  const values = txs.map((tx) => ({
    ...tx,
    id: createId(),
    verified: tx.verified ?? 0,
    createdAt: now,
    updatedAt: now,
  }));
  const result = await db.insert(transactions).values(values).run();
  return result.changes === values.length;
};

export const summarizeByCategory = async (
  query?: { start?: Date; end?: Date; categories?: string[] }
): Promise<
  { category: string; balance: number; income: number; expense: number }[] | null
> => {
  const { start, end, categories = [] } = query ?? {};
  const startTs = start?.getTime() ?? 0;
  const endTs = end?.getTime() ?? Date.now();

  const rows = await db
    .select({
      category: transactions.category,
      balance: sum(transactions.amount),
      income: sum(sql<number>`CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END`),
      expense: sum(sql<number>`CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END`),
    })
    .from(transactions)
    .where(and(between(transactions.transactionDate, startTs, endTs), categories.length ? inArray(transactions.category, categories) : undefined))
    .groupBy(transactions.category)
    .all();

  if (!rows.length) return null;
  return rows.map((r) => ({
    category: r.category,
    balance: Number(r.balance ?? 0),
    income: Number(r.income ?? 0),
    expense: Number(r.expense ?? 0),
  }));
};

export const summarizeByMonth = async (query?: { start?: Date; end?: Date; categories?: string[] }) => {
  const startTs = query?.start?.getTime() ?? 0;
  const endTs = query?.end?.getTime() ?? Date.now();
  const categories = query?.categories ?? [];
  const rows = await db.select({
    month: sql<string>`strftime('%Y-%m', ${transactions.transactionDate} / 1000, 'unixepoch')`,
    expense: sum(sql<number>`CASE WHEN ${transactions.amount} < 0 THEN -${transactions.amount} ELSE 0 END`),
  }).from(transactions).where(and(between(transactions.transactionDate, startTs, endTs), categories.length ? inArray(transactions.category, categories) : undefined)).groupBy(sql`strftime('%Y-%m', ${transactions.transactionDate} / 1000, 'unixepoch')`).all();
  return rows.map(row => ({ month: row.month, expense: Number(row.expense ?? 0) })).sort((a, b) => a.month.localeCompare(b.month));
};

export const setVerification = async (
  id: string,
  verified: number
): Promise<boolean> => {
  const result = await db
    .update(transactions)
    .set({ verified })
    .where(eq(transactions.id, id))
    .run();
  return result.changes > 0;
};
