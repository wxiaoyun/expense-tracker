import { db, transactions } from ".";
import { Transaction } from "./transactions";

export type RecurringTransaction = {
  id: number;
  amount: number;
  category: string;
  description?: string;
  start_date: number;
  last_charged?: number;
  recurrence_value: string;
  created_at: number;
  updated_at: number;
};

const getRecurringTransaction = async (id: number) => {
  const result: RecurringTransaction[] = await db.select(
    "SELECT * FROM recurring_transactions WHERE id = $1",
    [id],
  );

  if (result.length === 0) {
    console.warn("[DB][getRecurringTransaction] no result");
    return null;
  }

  console.info("[DB][getRecurringTransaction] result %o", result);
  return result[0];
};

const listRecurringTransactions = async (query?: {
  start?: Date;
  end?: Date;
}) => {
  const { start, end } = query ?? {};

  const result = await db.select(
    "SELECT * FROM recurring_transactions WHERE start_date BETWEEN $1 AND $2 ORDER BY created_at DESC",
    [start?.getTime() ?? 0, end?.getTime() ?? new Date().getTime()],
  );

  console.info("[DB][listRecurringTransactions] result %o", result);
  return result as RecurringTransaction[];
};

const createRecurringTransaction = async (
  transaction: BeforeCreate<RecurringTransaction>,
) => {
  const now = new Date().getTime();

  const result = await db.execute(
    "INSERT INTO recurring_transactions (amount, category, start_date, recurrence_value, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
    [
      transaction.amount,
      transaction.category,
      transaction.start_date,
      transaction.recurrence_value,
      now,
      now,
    ],
  );

  if (!result.lastInsertId) {
    console.warn("[DB][createRecurringTransaction] no result");
    return null;
  }

  if (result.rowsAffected === 0) {
    console.warn("[DB][createRecurringTransaction] no rows affected");
    return null;
  }

  console.info("[DB][createRecurringTransaction] result %o", result);
  return {
    ...transaction,
    id: result.lastInsertId,
  } as RecurringTransaction;
};

const updateRecurringTransaction = async (
  transaction: BeforeUpdate<RecurringTransaction>,
) => {
  const now = new Date().getTime();
  const result = await db.execute(
    "UPDATE recurring_transactions SET amount = $1, category = $2, start_date = $3, last_charged = $4, recurrence_value = $5, updated_at = $6 WHERE id = $7",
    [
      transaction.amount,
      transaction.category,
      transaction.start_date,
      transaction.last_charged,
      transaction.recurrence_value,
      now,
      transaction.id,
    ],
  );

  if (result.rowsAffected === 0) {
    console.warn("[DB][updateRecurringTransaction] no rows affected");
    return null;
  }

  console.info("[DB][updateRecurringTransaction] result %o", result);
  return transaction;
};

const deleteRecurringTransaction = async (id: number) => {
  const result = await db.execute(
    "DELETE FROM recurring_transactions WHERE id = $1",
    [id],
  );

  console.info("[DB][deleteRecurringTransaction] result %o", result);
  return result.rowsAffected > 0;
};

const incurRecurringTransaction = async (id: number) => {
  const recurringTransaction = await getRecurringTransaction(id);

  if (!recurringTransaction) {
    console.warn("[DB][incurRecurringTransaction] no recurring transaction");
    return null;
  }

  const now = new Date().getTime();

  const transaction = await transactions.create({
    amount: recurringTransaction.amount,
    category: recurringTransaction.category,
    description: recurringTransaction.description,
    transaction_date: now,
    recurring_transaction_id: recurringTransaction.id,
  });

  console.info(
    "[DB][incurRecurringTransaction] incurred transaction %o",
    transaction,
  );

  await updateRecurringTransaction({
    ...recurringTransaction,
    last_charged: now,
  });

  console.info(
    "[DB][incurRecurringTransaction] updated recurring transaction %o",
    recurringTransaction,
  );
  return transaction;
};

const listTransactionsByRecurringTransactionId = async (id: number) => {
  const result = await db.select(
    "SELECT * FROM transactions WHERE recurring_transaction_id = $1",
    [id],
  );
  return result as Transaction[];
};

const batchCreateRecurringTransactions = async (
  transactions: BeforeCreate<RecurringTransaction>[],
) => {
  if (transactions.length === 0) {
    return [];
  }

  console.info(
    "[DB][batchCreateRecurringTransactions] transactions %o",
    transactions,
  );

  const placeholders = transactions
    .map((_, index) => {
      const offset = index * 7;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    })
    .join(", ");

  const now = new Date().getTime();

  const values = transactions.flatMap((transaction) => [
    transaction.amount,
    transaction.category,
    transaction.description,
    transaction.start_date,
    transaction.recurrence_value,
    now,
    now,
  ]);

  const result = await db.execute(
    `INSERT INTO recurring_transactions (amount, category, description, start_date, recurrence_value, created_at, updated_at) 
     VALUES ${placeholders} RETURNING id`,
    values,
  );

  console.info("[DB][batchCreateRecurringTransactions] result %o", result);
  return result.rowsAffected === transactions.length;
};

const clearRecurringTransactions = async () => {
  const result = await db.execute("DELETE FROM recurring_transactions");
  console.info("[DB][clearRecurringTransactions] result %o", result);
  return result.rowsAffected > 0;
};

export default {
  get: getRecurringTransaction,
  list: listRecurringTransactions,
  listTransactions: listTransactionsByRecurringTransactionId,
  create: createRecurringTransaction,
  update: updateRecurringTransaction,
  delete: deleteRecurringTransaction,
  clear: clearRecurringTransactions,
  incur: incurRecurringTransaction,
  batchCreate: batchCreateRecurringTransactions,
};
