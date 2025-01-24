import { db } from ".";

export type Transaction = {
  id: number;
  amount: number;
  transaction_date: number;
  category: string;
  description?: string;
  recurring_transaction_id?: number;
  created_at: number;
  updated_at: number;
};

const getTransaction = async (id: number) => {
  const result: Transaction[] = await db.select(
    "SELECT * FROM transactions WHERE id = $1",
    [id],
  );

  if (result.length === 0) {
    return null;
  }

  return result[0] as Transaction;
};

const listTransactions = async (query?: { start?: Date; end?: Date }) => {
  const { start, end } = query ?? {};

  const result = await db.select(
    "SELECT * FROM transactions WHERE transaction_date BETWEEN $1 AND $2",
    [start?.getTime() ?? 0, end?.getTime() ?? new Date().getTime()],
  );

  return result as Transaction[];
};

const createTransaction = async (
  transaction: Omit<Transaction, "id" | "created_at" | "updated_at">,
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
    return null;
  }

  return {
    ...transaction,
    id: result.lastInsertId,
    created_at: now,
    updated_at: now,
  } as Transaction;
};

const updateTransaction = async (
  transaction: Transaction,
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
    return null;
  }

  return {
    ...transaction,
    updated_at: now,
  } as Transaction;
};

const listCategories = async () => {
  const result: Pick<Transaction, "category">[] = await db.select(
    "SELECT DISTINCT category FROM transactions",
  );
  return result;
};

export default {
  get: getTransaction,
  list: listTransactions,
  create: createTransaction,
  update: updateTransaction,
  categories: listCategories,
};
