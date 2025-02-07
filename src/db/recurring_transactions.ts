import { validateOccurrence } from "@/libs/date";
import { parseExpression } from "cron-parser";
import { z } from "zod";
import {
  db,
  RECURRING_TRANSACTIONS_TABLE,
  sql,
  transactions,
  TRANSACTIONS_TABLE,
} from ".";
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
  const builder = sql
    .select()
    .from(RECURRING_TRANSACTIONS_TABLE)
    .where("id", id);

  const q = builder.toSQL().toNative();
  console.info("[DB][getRecurringTransaction] query ", q);

  const result: RecurringTransaction[] = await db.select(
    q.sql,
    q.bindings as unknown[],
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

  const builder = sql
    .select()
    .from(RECURRING_TRANSACTIONS_TABLE)
    .whereBetween("start_date", [
      start?.getTime() ?? 0,
      end?.getTime() ?? new Date().getTime(),
    ])
    .orderBy("created_at", "desc");

  if (categories.length > 0) {
    builder.whereIn("category", categories);
  }

  const q = builder.toSQL().toNative();
  console.info("[DB][listRecurringTransactions] query ", q);

  const result: RecurringTransaction[] = await db.select(
    q.sql,
    q.bindings as unknown[],
  );
  console.info("[DB][listRecurringTransactions] result %o", result);
  return result;
};

const createRecurringTransaction = async (
  transaction: BeforeCreate<RecurringTransaction>,
) => {
  const now = Date.now();
  const builder = sql
    .insert({
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      start_date: transaction.start_date,
      recurrence_value: transaction.recurrence_value,
      created_at: now,
      updated_at: now,
    })
    .into(RECURRING_TRANSACTIONS_TABLE);

  const q = builder.toSQL().toNative();
  console.info("[DB][createRecurringTransaction] query ", q);

  const result = await db.execute(q.sql, q.bindings as unknown[]);

  if (!result.lastInsertId || result.rowsAffected !== 1) {
    console.warn("[DB][createRecurringTransaction] no result");
    return null;
  }

  console.info("[DB][createRecurringTransaction] result %o", result);
  return {
    ...transaction,
    id: result.lastInsertId,
    created_at: now,
    updated_at: now,
  } as RecurringTransaction;
};

const updateRecurringTransaction = async (
  transaction: BeforeUpdate<RecurringTransaction>,
) => {
  const now = Date.now();
  const builder = sql
    .update({
      amount: transaction.amount,
      category: transaction.category,
      description: transaction.description,
      start_date: transaction.start_date,
      last_charged: transaction.last_charged,
      recurrence_value: transaction.recurrence_value,
      updated_at: now,
    })
    .from(RECURRING_TRANSACTIONS_TABLE)
    .where("id", transaction.id);

  const q = builder.toSQL().toNative();
  console.info("[DB][updateRecurringTransaction] query ", q);

  const result = await db.execute(q.sql, q.bindings as unknown[]);

  if (result.rowsAffected !== 1) {
    console.warn("[DB][updateRecurringTransaction] no rows affected");
    return null;
  }

  console.info("[DB][updateRecurringTransaction] result %o", result);
  return {
    ...transaction,
    updated_at: now,
  } as RecurringTransaction;
};

const deleteRecurringTransaction = async (id: number) => {
  const builder = sql
    .delete()
    .from(RECURRING_TRANSACTIONS_TABLE)
    .where("id", id);

  const q = builder.toSQL().toNative();
  console.info("[DB][deleteRecurringTransaction] query ", q);

  const result = await db.execute(q.sql, q.bindings as unknown[]);
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
  const builder = sql
    .select()
    .from(TRANSACTIONS_TABLE)
    .where("recurring_transaction_id", id);

  const q = builder.toSQL().toNative();
  console.info("[DB][listTransactionsByRecurringTransactionId] query ", q);

  const result = await db.select(q.sql, q.bindings as unknown[]);
  return result as Transaction[];
};

const batchCreateRecurringTransactions = async (
  transactions: BeforeCreate<RecurringTransaction>[],
) => {
  if (transactions.length === 0) {
    return [];
  }

  const now = Date.now();
  const builder = sql
    .insert(
      transactions.map((transaction) => ({
        amount: transaction.amount,
        category: transaction.category,
        description: transaction.description,
        start_date: transaction.start_date,
        recurrence_value: transaction.recurrence_value,
        created_at: now,
        updated_at: now,
      })),
    )
    .into(RECURRING_TRANSACTIONS_TABLE);

  const q = builder.toSQL().toNative();
  console.info("[DB][batchCreateRecurringTransactions] query ", q);

  const result = await db.execute(q.sql, q.bindings as unknown[]);
  console.info("[DB][batchCreateRecurringTransactions] result %o", result);
  return result.rowsAffected === transactions.length;
};

const clearRecurringTransactions = async () => {
  const builder = sql.delete().from(RECURRING_TRANSACTIONS_TABLE);

  const q = builder.toSQL().toNative();
  console.info("[DB][clearRecurringTransactions] query ", q);

  const result = await db.execute(q.sql);
  console.info("[DB][clearRecurringTransactions] result %o", result);
  return result.rowsAffected > 0;
};

const listCategories = async () => {
  const builder = sql.distinct(["category"]).from(RECURRING_TRANSACTIONS_TABLE);

  const q = builder.toSQL().toNative();
  console.info("[DB][listCategories] query ", q);

  const result: Pick<RecurringTransaction, "category">[] = await db.select(
    q.sql,
  );
  console.log(
    "[DB][listCategories] result found for categories, returning %o",
    result,
  );
  return result;
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
  listCategories: listCategories,
};
