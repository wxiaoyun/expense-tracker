import { db } from ".";

export type RecurringTransaction = {
  id: number;
  amount: number;
  category: string;
  description?: string;
  start_date: number;
  end_date?: number;
  interval: number;
  created_at: number;
  updated_at: number;
};

const getRecurringTransaction = async (id: number) => {
  const result = await db.select(
    "SELECT * FROM recurring_transactions WHERE id = $1",
    [id],
  );

  return result as Option<RecurringTransaction>;
};

const listRecurringTransactions = async (query?: {
  start?: Date;
  end?: Date;
}) => {
  const { start, end } = query ?? {};

  const result = await db.select(
    "SELECT * FROM recurring_transactions WHERE start_date BETWEEN $1 AND $2",
    [start?.getTime() ?? 0, end?.getTime() ?? new Date().getTime()],
  );

  return result as RecurringTransaction[];
};

const createRecurringTransaction = async (
  transaction: RecurringTransaction,
) => {
  const result = await db.execute(
    "INSERT INTO recurring_transactions (amount, category, start_date, end_date, interval, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      transaction.amount,
      transaction.category,
      transaction.start_date,
      transaction.end_date,
      transaction.interval,
      transaction.created_at,
      transaction.updated_at,
    ],
  );

  if (!result.lastInsertId) {
    return null;
  }

  if (result.rowsAffected === 0) {
    return null;
  }

  return {
    ...transaction,
    id: result.lastInsertId,
  } as RecurringTransaction;
};

const updateRecurringTransaction = async (
  transaction: RecurringTransaction,
) => {
  const result = await db.execute(
    "UPDATE recurring_transactions SET amount = $1, category = $2, start_date = $3, end_date = $4, interval = $5, updated_at = $6 WHERE id = $7",
    [
      transaction.amount,
      transaction.category,
      transaction.start_date,
      transaction.end_date,
      transaction.interval,
      transaction.updated_at,
      transaction.id,
    ],
  );

  if (result.rowsAffected === 0) {
    return null;
  }

  return transaction;
};

const deleteRecurringTransaction = async (id: number) => {
  const result = await db.execute(
    "DELETE FROM recurring_transactions WHERE id = $1",
    [id],
  );

  return result.rowsAffected > 0;
};

export default {
  get: getRecurringTransaction,
  list: listRecurringTransactions,
  create: createRecurringTransaction,
  update: updateRecurringTransaction,
  delete: deleteRecurringTransaction,
};
