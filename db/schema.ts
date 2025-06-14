import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { z } from "zod";

import { validateOccurrence } from "@/libs/date";

export const recurringTransactions = sqliteTable(
  "recurring_transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    amount: real("amount").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    startDate: integer("start_date").notNull(),
    lastCharged: integer("last_charged"),
    recurrenceValue: text("recurrence_value").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    dateIdx: index("idx_recurring_transactions_date").on(table.startDate),
    categoryIdx: index("idx_recurring_transactions_category").on(
      table.category,
    ),
    lastChargedIdx: index("idx_recurring_transactions_last_charged").on(
      table.lastCharged,
    ),
  }),
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    amount: real("amount").notNull(),
    transactionDate: integer("transaction_date").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    recurringTransactionId: integer("recurring_transaction_id"),
    verified: integer("verified").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    dateIdx: index("idx_transactions_date").on(table.transactionDate),
    categoryIdx: index("idx_transactions_category").on(table.category),
    recurringIdx: index("idx_transactions_recurring").on(
      table.recurringTransactionId,
    ),
    verifiedIdx: index("idx_transactions_verified").on(table.verified),
  }),
);

export const TransactionSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number(),
  transactionDate: z.number().int().positive(),
  description: z.string().optional(),
  category: z.string(),
  recurringTransactionId: z.number().int().positive().optional(),
  verified: z.number().int().min(0).max(1).default(0),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export const RecurringTransactionSchema = z.object({
  id: z.number().int().positive(),
  amount: z.number(),
  category: z.string(),
  description: z.string().optional(),
  startDate: z.number().int().positive(),
  lastCharged: z.number().int().positive().optional(),
  recurrenceValue: z.string().refine((data) => {
    const res = validateOccurrence(data);
    return res.ok;
  }, "Recurrence value is invalid cron expression"),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
