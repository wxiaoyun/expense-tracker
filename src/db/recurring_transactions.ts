import { validateOccurrence } from "@/libs/date";
import { parseExpression } from "cron-parser";
import { z } from "zod";
import { db, transactions } from ".";
import { Transaction } from "./transactions";

export const RecurringTransactionSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number(),
  category: z.string(),
  description: z.string().optional(),
  start_date: z.number().int().positive(),
  last_charged: z.number().int().positive().optional(),
  recurrence_value: z.string().refine((data) => {
    const res = validateOccurrence(data);
    return res.ok;
  }, "Recurrence value is invalid cron expression"),
  created_at: z.number().int().positive(),
  updated_at: z.number().int().positive(),
});

export type RecurringTransaction = z.infer<typeof RecurringTransactionSchema>;

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
  categories?: string[];
}) => {
  const { start, end, categories = [] } = query ?? {};

  const categoryClause =
    categories.length > 0
      ? `AND category IN (${categories.map((_, i) => `$${i + 3}`).join(", ")})`
      : "";

  console.info(
    "[DB][listRecurringTransactions] start %s, end %s, categories %o",
    start,
    end,
    categories,
  );

  const result: RecurringTransaction[] = await db.select(
    `SELECT * FROM recurring_transactions WHERE start_date BETWEEN $1 AND $2 ${categoryClause} ORDER BY created_at DESC`,
    [
      start?.getTime() ?? 0,
      end?.getTime() ?? new Date().getTime(),
      ...categories,
    ],
  );

  console.info("[DB][listRecurringTransactions] result %o", result);
  return result;
};

const createRecurringTransaction = async (
  transaction: BeforeCreate<RecurringTransaction>,
) => {
  const now = new Date().getTime();

  const result = await db.execute(
    "INSERT INTO recurring_transactions (amount, category, description, start_date, recurrence_value, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [
      transaction.amount,
      transaction.category,
      transaction.description,
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
  const updatedTransaction = {
    ...transaction,
    updated_at: now,
  } as RecurringTransaction;
  const result = await db.execute(
    "UPDATE recurring_transactions SET amount = $1, category = $2, description = $3, start_date = $4, last_charged = $5, recurrence_value = $6, updated_at = $7 WHERE id = $8",
    [
      updatedTransaction.amount,
      updatedTransaction.category,
      updatedTransaction.description,
      updatedTransaction.start_date,
      updatedTransaction.last_charged,
      updatedTransaction.recurrence_value,
      updatedTransaction.updated_at,
      updatedTransaction.id,
    ],
  );

  if (result.rowsAffected === 0) {
    console.warn("[DB][updateRecurringTransaction] no rows affected");
    return null;
  }

  console.info("[DB][updateRecurringTransaction] result %o", result);
  return updatedTransaction;
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
  const now = new Date();
  const rt = await getRecurringTransaction(id);

  if (!rt) {
    console.warn("[DB][incurRecurringTransaction] no recurring transaction");
    return null;
  }

  const lastCharged = new Date(rt.last_charged ?? rt.start_date);
  const incurDates: Date[] = [];

  const cronExp = parseExpression(rt.recurrence_value, {
    currentDate: lastCharged,
  });

  for (
    let nextDate = cronExp.next().toDate();
    nextDate <= now;
    nextDate = cronExp.next().toDate()
  ) {
    incurDates.push(nextDate);
  }

  if (incurDates.length === 0) {
    console.info(
      `[DB][incurRecurringTransaction] no transactions to create for recurring transaction ${id}`,
    );
    return 0;
  }

  const toCreate = incurDates.map(
    (date) =>
      ({
        amount: rt.amount,
        category: rt.category,
        description: rt.description,
        transaction_date: date.getTime(),
        recurring_transaction_id: rt.id,
      }) as BeforeCreate<Transaction>,
  );

  const res = await transactions.batchCreate(toCreate);
  if (!res) {
    console.error(
      `[DB][incurRecurringTransaction] failed to create transactions for recurring transaction ${id}`,
    );
    return null;
  }

  const incurred = toCreate.length;

  console.info(
    "[DB][incurRecurringTransaction] total incurred %d, updated recurring transaction %o",
    incurred,
    rt,
  );

  const lastDate = incurDates[incurDates.length - 1];
  const updated = await updateRecurringTransaction({
    ...rt,
    last_charged: lastDate.getTime(),
  });

  if (!updated) {
    console.error(
      `[DB][incurRecurringTransaction] failed to update recurring transaction ${id}`,
    );
    return null;
  }

  return incurred;
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
