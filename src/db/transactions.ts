import { chunk } from "lodash";
import { z } from "zod";
import { db, sql, TRANSACTIONS_TABLE } from ".";

export const TransactionSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number(),
  transaction_date: z.number().int().positive(),
  category: z.string(),
  description: z.string().optional(),
  recurring_transaction_id: z.number().int().positive().optional(),
  verified: z.number().int().optional(),
  created_at: z.number().int().positive(),
  updated_at: z.number().int().positive(),
});

export type Transaction = z.infer<typeof TransactionSchema>;

const validOrderBy = new Set([
  "transaction_date",
  "amount",
  "category",
  "description",
  "created_at",
  "updated_at",
]);

const getTransaction = async (id: number) => {
  const builder = sql.select().from(TRANSACTIONS_TABLE).where("id", id);

  const q = builder.toSQL().toNative();
  console.info("[DB][getTransaction] query ", q);

  const result: Transaction[] = await db.select(q.sql, q.bindings as unknown[]);

  if (result.length === 0) {
    console.warn(
      "[DB][getTransaction] no result found for id %s, returning null",
      id,
    );
    return null;
  }

  console.info(
    "[DB][getTransaction] result found for id %s, returning %o",
    id,
    result[0],
  );
  return result[0];
};

const listTransactions = async (query?: {
  start?: Date;
  end?: Date;
  limit?: number;
  offset?: number;
  orderBy?: [keyof Transaction, "ASC" | "DESC"];
  categories?: string[];
  verified?: number;
}) => {
  const {
    start,
    end,
    limit = Number.MAX_SAFE_INTEGER,
    offset = 0,
    orderBy = ["transaction_date", "DESC"],
    categories = [],
    verified,
  } = query ?? {};

  if (!validOrderBy.has(orderBy[0])) {
    console.warn(
      "[DB][listTransactions] invalid orderBy %o, returning null",
      orderBy,
    );
    return {
      items: [],
      nextOffset: null,
    };
  }

  const startDate = start?.getTime() ?? 0;
  const endDate = end?.getTime() ?? new Date().getTime();

  const builder = sql
    .select()
    .from(TRANSACTIONS_TABLE)
    .whereBetween("transaction_date", [startDate, endDate])
    .orderBy(orderBy[0], orderBy[1])
    .limit(limit)
    .offset(offset);

  if (categories.length > 0) {
    builder.whereIn("category", categories);
  }

  if (verified !== undefined) {
    builder.where("verified", verified);
  }

  const q = builder.toSQL().toNative();
  console.info("[DB][listTransactions] query ", q);

  const result: Transaction[] = await db.select(q.sql, q.bindings as unknown[]);

  console.info(
    "[DB][listTransactions] result found for %o, returning %o",
    q,
    result,
  );

  const nextOffset = result.length === 0 ? null : offset + limit;
  return {
    items: result,
    nextOffset,
  };
};

const summarizeTransactions = async (query?: {
  start?: Date;
  end?: Date;
  categories?: string[];
  verified?: number;
}) => {
  const { start, end, categories = [], verified } = query ?? {};
  const startDate = start?.getTime() ?? 0;
  const endDate = end?.getTime() ?? new Date().getTime();

  const builder = sql
    .select(
      sql.raw("SUM(amount) as balance"),
      sql.raw("SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income"),
      sql.raw("SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense"),
    )
    .from(TRANSACTIONS_TABLE)
    .whereBetween("transaction_date", [startDate, endDate]);

  if (categories.length > 0) {
    builder.whereIn("category", categories);
  }

  if (verified !== undefined) {
    builder.where("verified", verified);
  }

  const q = builder.toSQL().toNative();
  console.info("[DB][summarizeTransactions] query ", q);

  const result: {
    balance: number;
    income: number;
    expense: number;
  }[] = await db.select(q.sql, q.bindings as unknown[]);

  if (result.length === 0) {
    console.warn(
      "[DB][summarizeTransactions] no result found for %o, returning null",
      query,
    );
    return null;
  }

  console.info(
    "[DB][summarizeTransactions] result found for %o, returning %o",
    query,
    result[0],
  );
  return result[0];
};

const createTransaction = async (
  transaction: BeforeCreate<Transaction>,
): Promise<Option<Transaction>> => {
  const now = Date.now();
  const builder = sql(TRANSACTIONS_TABLE).insert({
    amount: transaction.amount,
    transaction_date: transaction.transaction_date,
    category: transaction.category,
    description: transaction.description,
    recurring_transaction_id: transaction.recurring_transaction_id,
    verified: transaction.verified ?? 0,
    created_at: now,
    updated_at: now,
  });

  const q = builder.toSQL().toNative();
  console.info("[DB][createTransaction] query ", q);

  const result = await db.execute(q.sql, q.bindings as unknown[]);

  if (!result.lastInsertId || result.rowsAffected !== 1) {
    console.warn(
      "[DB][createTransaction] failed to create transaction %o, returning null",
      transaction,
    );
    return null;
  }

  console.log(
    "[DB][createTransaction] result found for transaction %s, returning %o",
    transaction,
    result.lastInsertId,
  );
  return {
    ...transaction,
    id: result.lastInsertId,
    created_at: now,
    updated_at: now,
  } as Transaction;
};

const updateTransaction = async (
  transaction: BeforeUpdate<Transaction>,
): Promise<Option<Transaction>> => {
  const now = Date.now();
  const builder = sql
    .update({
      amount: transaction.amount,
      transaction_date: transaction.transaction_date,
      category: transaction.category,
      description: transaction.description,
      recurring_transaction_id: transaction.recurring_transaction_id,
      verified: transaction.verified ?? 0,
      updated_at: now,
    })
    .from(TRANSACTIONS_TABLE)
    .where("id", transaction.id);

  const q = builder.toSQL().toNative();
  console.info("[DB][updateTransaction] query ", q);

  const result = await db.execute(q.sql, q.bindings as unknown[]);

  if (result.rowsAffected !== 1) {
    console.warn(
      "[DB][updateTransaction] no result found for transaction %o, returning null",
      transaction,
    );
    return null;
  }

  console.log(
    "[DB][updateTransaction] result found for transaction %o, returning %o",
    transaction,
    result.rowsAffected,
  );
  return {
    ...transaction,
    updated_at: now,
  } as Transaction;
};

const deleteTransaction = async (id: number) => {
  const builder = sql.delete().from(TRANSACTIONS_TABLE).where("id", id);

  const q = builder.toSQL().toNative();
  console.info("[DB][deleteTransaction] query ", q);

  const result = await db.execute(q.sql, q.bindings as unknown[]);

  console.info("[DB][deleteTransaction] result %o", result);
  return result.rowsAffected > 0;
};

const listCategories = async () => {
  const builder = sql.distinct(["category"]).from(TRANSACTIONS_TABLE);

  const q = builder.toSQL().toNative();
  console.info("[DB][listCategories] query ", q);

  const result: Pick<Transaction, "category">[] = await db.select(q.sql);

  console.log(
    "[DB][listCategories] result found for categories, returning %o",
    result,
  );
  return result;
};

const clearTransactions = async () => {
  const builder = sql.delete().from(TRANSACTIONS_TABLE);

  const q = builder.toSQL().toNative();
  console.info("[DB][clearTransactions] query ", q);

  const result = await db.execute(q.sql);
  console.info("[DB][clearTransactions] result %o", result);
};

const batchCreateTransactions = async (
  transactions: BeforeCreate<Transaction>[],
): Promise<boolean> => {
  if (transactions.length > 300) {
    console.warn(
      "[DB][batchCreateTransactions] batch size %d is too large, chunking into slices of 300",
      transactions.length,
    );

    const chunks = chunk(transactions, 300);
    const results = await Promise.allSettled(
      chunks.map((chunk) => batchCreateTransactions(chunk)),
    );

    return results.every(
      (result) => result.status === "fulfilled" && result.value,
    );
  }

  if (transactions.length === 0) {
    console.warn("[DB][batchCreateTransactions] no transactions to create");
    return false;
  }

  const now = Date.now();
  const builder = sql(TRANSACTIONS_TABLE).insert(
    transactions.map((transaction) => ({
      amount: transaction.amount,
      transaction_date: transaction.transaction_date,
      category: transaction.category,
      description: transaction.description,
      recurring_transaction_id: transaction.recurring_transaction_id,
      verified: transaction.verified ?? 0,
      created_at: now,
      updated_at: now,
    })),
  );

  const q = builder.toSQL().toNative();
  console.info("[DB][batchCreateTransactions] query ", q);

  const result = await db.execute(q.sql, q.bindings as unknown[]);

  return result.rowsAffected === transactions.length;
};

const summarizeByCategory = async (query?: { start?: Date; end?: Date }) => {
  const { start, end } = query ?? {};
  const startDate = start?.getTime() ?? 0;
  const endDate = end?.getTime() ?? new Date().getTime();

  const builder = sql
    .select(
      "category",
      sql.raw("SUM(amount) as balance"),
      sql.raw("SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income"),
      sql.raw("SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense"),
    )
    .from(TRANSACTIONS_TABLE)
    .whereBetween("transaction_date", [startDate, endDate])
    .groupBy("category");

  const q = builder.toSQL().toNative();
  console.info("[DB][summarizeByCategory] query ", q);

  const result: {
    category: string;
    balance: number;
    income: number;
    expense: number;
  }[] = await db.select(q.sql, q.bindings as unknown[]);

  if (result.length === 0) {
    console.warn(
      "[DB][summarizeByCategory] no result found for %o, returning null",
      query,
    );
    return null;
  }

  console.info(
    "[DB][summarizeByCategory] result found for %o, returning %o",
    query,
    result,
  );

  return result;
};

const setVerification = async (id: number, verified: number) => {
  const builder = sql
    .update({ verified })
    .from(TRANSACTIONS_TABLE)
    .where("id", id);

  const q = builder.toSQL().toNative();
  console.info("[DB][setVerification] query ", q);

  const result = await db.execute(q.sql, q.bindings as unknown[]);

  console.info("[DB][setVerification] result ", result);
  return result.rowsAffected > 0;
};

export default {
  get: getTransaction,
  list: listTransactions,
  create: createTransaction,
  update: updateTransaction,
  delete: deleteTransaction,
  categories: listCategories,
  clear: clearTransactions,
  batchCreate: batchCreateTransactions,
  summarize: summarizeTransactions,
  summarizeByCategory,
  setVerification,
};
