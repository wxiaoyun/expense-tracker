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

const listTransactions = async (query?: { start?: Date; end?: Date }) => {
  const { start, end } = query ?? {};
  const startDate = start?.getTime() ?? 0;
  const endDate = end?.getTime() ?? new Date().getTime();

  const result = await db.select(
    "SELECT * FROM transactions WHERE transaction_date BETWEEN $1 AND $2",
    [startDate, endDate],
  );

  console.log(
    "[DB][listTransactions] result found for start %s and end %s, returning %o",
    startDate,
    endDate,
    result,
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

export default {
  get: getTransaction,
  list: listTransactions,
  create: createTransaction,
  update: updateTransaction,
  categories: listCategories,
};
