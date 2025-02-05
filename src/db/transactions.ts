import { chunk } from "lodash";
import { z } from "zod";
import { db } from ".";

export const TransactionSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number(),
  transaction_date: z.number().int().positive(),
  category: z.string(),
  description: z.string().optional(),
  recurring_transaction_id: z.number().int().positive().optional(),
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
  const result: Transaction[] = await db.select(
    "SELECT * FROM transactions WHERE id = $1",
    [id],
  );

  if (result.length === 0) {
    console.warn(
      "[DB][getTransaction] no result found for id %s, returning null",
      id,
    );
    return null;
  }

  console.log(
    "[DB][getTransaction] result found for id %s, returning %o",
    id,
    result[0],
  );
  return result[0] as Transaction;
};

const listTransactions = async (query?: {
  start?: Date;
  end?: Date;
  limit?: number;
  offset?: number;
  orderBy?: [keyof Transaction, "ASC" | "DESC"];
  categories?: string[];
}) => {
  const {
    start,
    end,
    limit = Number.MAX_SAFE_INTEGER,
    offset = 0,
    orderBy = ["transaction_date", "DESC"],
    categories = [],
  } = query ?? {};

  if (!validOrderBy.has(orderBy[0])) {
    console.warn(
      "[DB][listTransactions] invalid orderBy %o, returning null",
      orderBy,
    );
    return {
      items: [],
      total: 0,
      nextOffset: null,
    };
  }

  const startDate = start?.getTime() ?? 0;
  const endDate = end?.getTime() ?? new Date().getTime();

  const categoryClause =
    categories.length > 0
      ? `AND category IN (${categories.map((_, i) => `$${i + 3}`).join(", ")})`
      : "";

  console.info(
    "[DB][listTransactions] startDate %s, endDate %s, limit %s, offset %s, orderBy %o, categories %o",
    startDate,
    endDate,
    limit,
    offset,
    orderBy,
    categories,
  );

  const countResult: { count: number }[] = await db.select(
    `SELECT COUNT(*) as count FROM transactions 
     WHERE transaction_date BETWEEN $1 AND $2 ${categoryClause}`,
    [startDate, endDate, ...categories],
  );

  if (countResult.length === 0) {
    console.warn(
      "[DB][listTransactions] no result found for start %s and end %s, returning null",
      startDate,
      endDate,
    );
    return {
      items: [],
      total: 0,
      nextOffset: null,
    };
  }

  console.info(
    "[DB][listTransactions] total transactions count %d for start %s and end %s, orderBy %o",
    countResult[0].count,
    startDate,
    endDate,
    orderBy,
  );

  const result: Transaction[] = await db.select(
    `SELECT * FROM transactions 
     WHERE transaction_date BETWEEN $1 AND $2 ${categoryClause}
     ORDER BY ${orderBy[0]} ${orderBy[1]} 
     LIMIT $${categories.length + 3} OFFSET $${categories.length + 4}`,
    [startDate, endDate, ...categories, limit, offset],
  );

  const nextOffset = result.length === 0 ? null : offset + limit;

  console.info(
    "[DB][listTransactions] result found for start %s, end %s and limit %s, offset %s, orderBy %o, returning %o",
    startDate,
    endDate,
    limit,
    offset,
    orderBy,
    result,
  );

  return {
    items: result,
    total: countResult[0].count,
    nextOffset,
  };
};

const summarizeTransactions = async (query?: { start?: Date; end?: Date }) => {
  const { start, end } = query ?? {};
  const startDate = start?.getTime() ?? 0;
  const endDate = end?.getTime() ?? new Date().getTime();

  console.info(
    "[DB][summarizeTransactions] startDate %s, endDate %s",
    startDate,
    endDate,
  );

  const result: {
    balance: number;
    income: number;
    expense: number;
  }[] = await db.select(
    "SELECT SUM(amount) as balance, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income, SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense FROM transactions WHERE transaction_date BETWEEN $1 AND $2",
    [startDate, endDate],
  );

  if (result.length === 0) {
    console.warn(
      "[DB][summarizeTransactions] no result found for start %s and end %s, returning null",
      startDate,
      endDate,
    );
    return null;
  }

  console.info(
    "[DB][summarizeTransactions] result found for start %s and end %s, returning %o",
    startDate,
    endDate,
    result[0],
  );

  return result[0];
};

const createTransaction = async (
  transaction: BeforeCreate<Transaction>,
): Promise<Option<Transaction>> => {
  const now = new Date().getTime();

  const result = await db.execute(
    "INSERT INTO transactions (amount, transaction_date, category, description, recurring_transaction_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      transaction.amount,
      transaction.transaction_date,
      transaction.category,
      transaction.description,
      transaction.recurring_transaction_id,
      now,
      now,
    ],
  );

  if (!result.lastInsertId || result.rowsAffected !== 1) {
    console.warn(
      "[DB][createTransaction] no result found for transaction %s, returning null",
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
  const now = new Date().getTime();

  const result = await db.execute(
    "UPDATE transactions SET amount = $1, transaction_date = $2, category = $3, description = $4, recurring_transaction_id = $5, updated_at = $6 WHERE id = $7",
    [
      transaction.amount,
      transaction.transaction_date,
      transaction.category,
      transaction.description,
      transaction.recurring_transaction_id,
      now,
      transaction.id,
    ],
  );

  if (result.rowsAffected !== 1) {
    console.warn(
      "[DB][updateTransaction] no result found for transaction %s, returning null",
      transaction,
    );
    return null;
  }

  console.log(
    "[DB][updateTransaction] result found for transaction %s, returning %o",
    transaction,
    result.lastInsertId,
  );
  return {
    ...transaction,
    updated_at: now,
  } as Transaction;
};

const deleteTransaction = async (id: number) => {
  const result = await db.execute("DELETE FROM transactions WHERE id = $1", [
    id,
  ]);
  console.info("[DB][deleteTransaction] result %o", result);
  return result.rowsAffected > 0;
};

const listCategories = async () => {
  const result: Pick<Transaction, "category">[] = await db.select(
    "SELECT DISTINCT category FROM transactions",
  );

  console.log(
    "[DB][listCategories] result found for categories, returning %o",
    result,
  );
  return result;
};

const clearTransactions = async () => {
  const result = await db.execute("DELETE FROM transactions");
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

  const placeholders = transactions
    .map((_, index) => {
      const offset = index * 7;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    })
    .join(", ");

  const now = new Date().getTime();
  const values = transactions.flatMap((transaction) => [
    transaction.amount,
    transaction.transaction_date,
    transaction.category,
    transaction.description,
    transaction.recurring_transaction_id,
    now,
    now,
  ]);

  const result = await db.execute(
    `INSERT INTO transactions (amount, transaction_date, category, description, recurring_transaction_id, created_at, updated_at) 
     VALUES ${placeholders} RETURNING id`,
    values,
  );

  return result.rowsAffected === transactions.length;
};

const summarizeByCategory = async (query?: { start?: Date; end?: Date }) => {
  const { start, end } = query ?? {};
  const startDate = start?.getTime() ?? 0;
  const endDate = end?.getTime() ?? new Date().getTime();

  console.info(
    "[DB][summarizeByCategory] startDate %s, endDate %s",
    startDate,
    endDate,
  );

  const result: {
    category: string;
    balance: number;
    income: number;
    expense: number;
  }[] = await db.select(
    "SELECT category, SUM(amount) as balance, SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income, SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expense FROM transactions WHERE transaction_date BETWEEN $1 AND $2 GROUP BY category",
    [startDate, endDate],
  );

  if (result.length === 0) {
    console.warn(
      "[DB][summarizeByCategory] no result found for start %s and end %s, returning null",
      startDate,
      endDate,
    );
    return null;
  }

  console.info(
    "[DB][summarizeByCategory] result found for start %s and end %s, returning %o",
    startDate,
    endDate,
    result,
  );

  return result;
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
};
