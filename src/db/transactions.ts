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

const listTransactions = async (query?: { 
  start?: Date; 
  end?: Date; 
  limit?: number;
  cursor?: number;
}) => {

  const { start, end, limit = Number.MAX_SAFE_INTEGER, cursor = 0 } = query ?? {};
  const startDate = Math.max(start?.getTime() ?? 0, cursor);
  const endDate = end?.getTime() ?? new Date().getTime();


  console.info("[DB][listTransactions] startDate %s, endDate %s, limit %s, cursor %s", startDate, endDate, limit, cursor);
  
  const countResult: { count: number }[] = await db.select(
    "SELECT COUNT(*) FROM transactions WHERE transaction_date BETWEEN $1 AND $2",
    [startDate, endDate],
  );


  if (countResult.length === 0) {
    console.warn(
      "[DB][listTransactions] no result found for start %s and end %s, returning null",
      startDate,
      endDate,
    );
    return {
      total: 0,
      items: [],
      nextCursor: null,
    };
  }

  console.info(
    "[DB][listTransactions] total transactions count %d for start %s and end %s",
    countResult[0].count,
    startDate,
    endDate,
  );

  const result: Transaction[] = await db.select(
    `SELECT * FROM transactions 
     WHERE transaction_date BETWEEN $1 AND $2 
     ORDER BY transaction_date ASC 
     LIMIT $3`,
    [startDate, endDate, limit],
  );

  const lastTransaction = result[result.length - 1];
  const nextCursor = lastTransaction ? lastTransaction.transaction_date : null;

  console.log(
    "[DB][listTransactions] result found for start %s, end %s and limit %s, returning %o",
    startDate,
    endDate,
    limit,
    result,
  );

  return {
    total: countResult[0].count,
    items: result as Transaction[],
    nextCursor: result.length === limit ? nextCursor : null,
  };
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
  return result.rowsAffected > 0;
};

const batchCreateTransactions = async (
  transactions: BeforeCreate<Transaction>[],
) => {
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

export default {
  get: getTransaction,
  list: listTransactions,
  create: createTransaction,
  update: updateTransaction,
  delete: deleteTransaction,
  categories: listCategories,
  clear: clearTransactions,
  batchCreate: batchCreateTransactions,
};
