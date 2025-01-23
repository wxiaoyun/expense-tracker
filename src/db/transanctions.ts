import { db } from ".";

export type Transaction = {
  id: number;
  amount: number;
  currency: string;
  transaction_date: number;
  category_id: number;
  description?: string;
  recurring_transaction_id?: number;
  created_at: number;
  updated_at: number;
};

const listTransactions = async (query: {
  dateRange: { start?: Date; end?: Date };
  category?: string[];
  amount: "positive" | "negative";
}) => {
  const { dateRange, category, amount } = query;

  let queryStr = "SELECT * FROM transactions WHERE date BETWEEN $1 AND $2";

  if (category) {
    queryStr += ` AND category IN (${category.map((_, index) => `$${3 + index}`).join(",")})`;
  }

  if (amount) {
    queryStr += ` AND amount ${amount === "positive" ? ">" : "<"} 0`;
  }

  console.log(queryStr);

  const result = await db.select(queryStr, [
    dateRange.start?.getTime() ?? 0,
    dateRange.end ? dateRange.end.getTime() : new Date().getTime(),
    ...(category ?? []),
  ]);

  return result as Transaction[];
};

const createTransaction = async (
  transaction: Omit<Transaction, "created_at" | "updated_at">,
) => {
  const now = new Date().getTime();

  const result = await db.execute(
    "INSERT INTO transactions (amount, currency, transaction_date, category_id, description, recurring_transaction_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      transaction.amount,
      transaction.currency,
      transaction.transaction_date,
      transaction.category_id,
      transaction.description,
      transaction.recurring_transaction_id,
      now,
      now,
    ],
  );

  if (!result.lastInsertId || result.rowsAffected !== 1) {
    return null;
  }

  return {
    ...transaction,
    id: result.lastInsertId,
    created_at: now,
    updated_at: now,
  } as Transaction;
};

const updateTransaction = async (transaction: Transaction) => {
  const now = new Date().getTime();

  const result = await db.execute(
    "UPDATE transactions SET amount = $1, currency = $2, transaction_date = $3, category_id = $4, description = $5, recurring_transaction_id = $6, updated_at = $7 WHERE id = $8",
    [
      transaction.amount,
      transaction.currency,
      transaction.transaction_date,
      transaction.category_id,
      transaction.description,
      transaction.recurring_transaction_id,
      now,
      transaction.id,
    ],
  );

  if (result.rowsAffected !== 1) {
    return null;
  }

  return {
    ...transaction,
    updated_at: now,
  } as Transaction;
};

export default {
  list: listTransactions,
  create: createTransaction,
  update: updateTransaction,
};
