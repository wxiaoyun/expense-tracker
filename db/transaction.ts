import { and, asc, between, desc, eq, gte, inArray, isNull, sql, sum } from "drizzle-orm";
import { db } from "./index";
import { transactions } from "./schema";
import { createId } from '@/libs/id';
import type { HistoricalTransactionInput } from './template-core';

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

type TransactionQueryContext = {
  startTs: number;
  endTs: number;
  categories: string[];
  verified?: number;
};

const getTransactionWhereContext = (
  query?: {
    start?: Date;
    end?: Date;
    categories?: string[];
    verified?: number;
  },
  defaultEndTs = Number.MAX_SAFE_INTEGER,
): TransactionQueryContext => ({
  startTs: query?.start?.getTime() ?? 0,
  endTs: query?.end?.getTime() ?? defaultEndTs,
  categories: query?.categories ?? [],
  verified: query?.verified,
});

const getActiveTransactionConditions = ({
  startTs,
  endTs,
  categories,
  verified,
}: TransactionQueryContext) => {
  const whereConditions = [isNull(transactions.deletedAt), between(transactions.transactionDate, startTs, endTs)];

  if (categories.length) {
    whereConditions.push(inArray(transactions.category, categories));
  }
  if (verified !== undefined) {
    whereConditions.push(eq(transactions.verified, verified ? 1 : 0));
  }

  return whereConditions;
};

export const getTransaction = async (id: string): Promise<Transaction | null> => {
  console.info('[transactions.get][stage=query] fetching transaction', { id });
  try {
    const result = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .get();
    return result ?? null;
  } catch (error) {
    console.error('[transactions.get][stage=query] transaction fetch failed', { id, error: String(error) });
    throw error;
  }
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
    limit = 50,
    offset = 0,
    orderBy = ["transactionDate", "DESC"],
    search,
  } = query ?? {};

  const { startTs, endTs, categories, verified } = getTransactionWhereContext(query);
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
  const whereConditions = getActiveTransactionConditions({ startTs, endTs, categories, verified });
  
  if (search) {
    whereConditions.push(sql`${transactions.description} LIKE ${`%${search}%`}`);
  }

  console.info('[transactions.list][stage=query] fetching transactions', {
    startTs,
    endTs,
    offset,
    limit,
    category_count: categories.length,
    verified: verified ?? null,
    has_search: Boolean(search),
  });

  try {
    const items = await db
      .select()
      .from(transactions)
      .where(and(...whereConditions))
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset)
      .all();

    console.info('[transactions.list][stage=query] rows fetched', {
      startTs,
      endTs,
      offset,
      limit,
      count: items.length,
      categories: categories.length,
      verified: verified ?? null,
      has_search: Boolean(search),
    });

    const nextOffset = items.length < limit ? null : offset + limit;
    return { items, nextOffset };
  } catch (error) {
    console.error('[transactions.list][stage=query] transaction list failed', {
      startTs,
      endTs,
      offset,
      limit,
      category_count: categories.length,
      verified: verified ?? null,
      has_search: Boolean(search),
      error: String(error),
    });
    throw error;
  }
};

export const summarizeTransactions = async (query?: {
  start?: Date;
  end?: Date;
  categories?: string[];
  verified?: number;
}): Promise<{ balance: number; income: number; expense: number } | null> => {
  const context = getTransactionWhereContext(query);
  const { startTs, endTs, categories, verified } = context;
  const whereConditions = getActiveTransactionConditions(context);

  console.info('[transactions.summary][stage=query] summarizing transactions', {
    startTs,
    endTs,
    category_count: categories.length,
    verified: verified ?? null,
  });

  try {
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
  } catch (error) {
    console.error('[transactions.summary][stage=query] transaction summary failed', {
      startTs,
      endTs,
      category_count: categories.length,
      verified: verified ?? null,
      error: String(error),
    });
    throw error;
  }
};

export const createTransaction = async (
  transaction: Omit<NewTransaction, "id" | "createdAt" | "updatedAt">
): Promise<Transaction | null> => {
  const now = Date.now();
  const id = createId();
  console.info('[transactions.create][stage=insert] creating transaction', { id });

  try {
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
        verified: transaction.verified ?? 0,
        deletedAt: transaction.deletedAt ?? null,
        createdAt: now,
        updatedAt: now,
      } as Transaction;
    }
    return null;
  } catch (error) {
    console.error('[transactions.create][stage=insert] transaction create failed', { id, error: String(error) });
    throw error;
  }
};

export const updateTransaction = async (
  transaction: Transaction
): Promise<Transaction | null> => {
  const now = Date.now();
  console.info('[transactions.update][stage=update] updating transaction', { id: transaction.id });

  try {
    const result = await db
      .update(transactions)
      .set({
        amount: transaction.amount,
        transactionDate: transaction.transactionDate,
        category: transaction.category,
        description: transaction.description,
        templateId: transaction.templateId,
        verified: transaction.verified ?? 0,
        notes: transaction.notes,
        updatedAt: now,
      })
      .where(and(eq(transactions.id, transaction.id), isNull(transactions.deletedAt)))
      .run();

    if (result.changes === 1) {
      return { ...transaction, updatedAt: now };
    }
    return null;
  } catch (error) {
    console.error('[transactions.update][stage=update] transaction update failed', { id: transaction.id, error: String(error) });
    throw error;
  }
};

export const softDeleteTransaction = async (id: string, deletedAt = Date.now()): Promise<boolean> => {
  console.info('[transactions.delete][stage=soft_delete] deleting transaction', { id, deletedAt });
  try {
    const result = await db
      .update(transactions)
      .set({ deletedAt, updatedAt: deletedAt })
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .run();
    return result.changes > 0;
  } catch (error) {
    console.error('[transactions.delete][stage=soft_delete] transaction delete failed', { id, error: String(error) });
    throw error;
  }
};

export const listCategories = async (): Promise<string[]> => {
  const queryContext = { deletedAt: null };
  console.info('[transactions.categories][stage=query] listing active transaction categories', queryContext);
  try {
    const rows = await db
      .selectDistinct({ category: transactions.category })
      .from(transactions)
      .where(isNull(transactions.deletedAt))
      .all();
    return rows.map((r) => r.category);
  } catch (error) {
    console.error('[transactions.categories][stage=query] category list failed', { ...queryContext, error: String(error) });
    throw error;
  }
};

export const clearTransactions = async (): Promise<void> => {
  const queryContext = { scope: 'all_transactions' };
  console.info('[transactions.clear][stage=physical_delete] clearing all transactions', queryContext);
  try {
    await db.delete(transactions).run();
  } catch (error) {
    console.error('[transactions.clear][stage=physical_delete] transaction clear failed', { ...queryContext, error: String(error) });
    throw error;
  }
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
  console.info('[transactions.batch_create][stage=insert] creating transactions', { count: values.length });

  try {
    const result = await db.insert(transactions).values(values).run();
    return result.changes === values.length;
  } catch (error) {
    console.error('[transactions.batch_create][stage=insert] transaction batch create failed', { count: values.length, error: String(error) });
    throw error;
  }
};

export const summarizeByCategory = async (
  query?: { start?: Date; end?: Date; categories?: string[] }
): Promise<
  { category: string; balance: number; income: number; expense: number }[] | null
> => {
  const context = getTransactionWhereContext(query, Date.now());
  const { startTs, endTs, categories } = context;

  console.info('[transactions.summary_by_category][stage=query] summarizing transactions by category', {
    startTs,
    endTs,
    category_count: categories.length,
  });

  try {
    const rows = await db
      .select({
        category: transactions.category,
        balance: sum(transactions.amount),
        income: sum(sql<number>`CASE WHEN ${transactions.amount} > 0 THEN ${transactions.amount} ELSE 0 END`),
        expense: sum(sql<number>`CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END`),
      })
      .from(transactions)
      .where(and(...getActiveTransactionConditions(context)))
      .groupBy(transactions.category)
      .all();

    if (!rows.length) return null;
    return rows.map((r) => ({
      category: r.category,
      balance: Number(r.balance ?? 0),
      income: Number(r.income ?? 0),
      expense: Number(r.expense ?? 0),
    }));
  } catch (error) {
    console.error('[transactions.summary_by_category][stage=query] category summary failed', {
      startTs,
      endTs,
      category_count: categories.length,
      error: String(error),
    });
    throw error;
  }
};

export const summarizeByMonth = async (query?: { start?: Date; end?: Date; categories?: string[] }) => {
  const context = getTransactionWhereContext(query, Date.now());
  const { startTs, endTs, categories } = context;

  console.info('[transactions.summary_by_month][stage=query] summarizing transactions by month', {
    startTs,
    endTs,
    category_count: categories.length,
  });

  try {
    const rows = await db.select({
      month: sql<string>`strftime('%Y-%m', ${transactions.transactionDate} / 1000, 'unixepoch')`,
      expense: sum(sql<number>`CASE WHEN ${transactions.amount} < 0 THEN -${transactions.amount} ELSE 0 END`),
    }).from(transactions)
      .where(and(...getActiveTransactionConditions(context)))
      .groupBy(sql`strftime('%Y-%m', ${transactions.transactionDate} / 1000, 'unixepoch')`)
      .all();
    return rows.map(row => ({ month: row.month, expense: Number(row.expense ?? 0) })).sort((a, b) => a.month.localeCompare(b.month));
  } catch (error) {
    console.error('[transactions.summary_by_month][stage=query] monthly summary failed', {
      startTs,
      endTs,
      category_count: categories.length,
      error: String(error),
    });
    throw error;
  }
};

export const listTemplateSuggestionRows = async (startDate: number): Promise<HistoricalTransactionInput[]> => {
  console.info('[transactions.template_suggestions][stage=query] listing historical suggestion rows', { startDate });
  try {
    return await db
      .select({
        amount: transactions.amount,
        transactionDate: transactions.transactionDate,
        description: transactions.description,
        category: transactions.category,
      })
      .from(transactions)
      .where(and(
        isNull(transactions.deletedAt),
        isNull(transactions.templateId),
        gte(transactions.transactionDate, startDate),
      ))
      .all();
  } catch (error) {
    console.error('[transactions.template_suggestions][stage=query] historical suggestion rows failed', { startDate, error: String(error) });
    throw error;
  }
};

export const setVerification = async (
  id: string,
  verified: number
): Promise<boolean> => {
  console.info('[transactions.verify][stage=update] updating transaction verification', { id, verified });
  try {
    const result = await db
      .update(transactions)
      .set({ verified })
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .run();
    return result.changes > 0;
  } catch (error) {
    console.error('[transactions.verify][stage=update] transaction verification failed', { id, verified, error: String(error) });
    throw error;
  }
};
