import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from 'uuid';

// Helper to generate deterministic UUID from integer (for migration)
// We'll use a fixed namespace for consistency
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // example, we can use a fixed one
// In migration we will use uuidv5 with this namespace and the integer id as string

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull().unique(),
    icon: text("icon").notNull(), // SF Symbol name
    color: text("color").notNull(), // hex
    is_preset: integer("is_preset", { mode: "boolean" }).notNull().default(false),
    sort_order: integer("sort_order").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({
    nameIdx: index("idx_categories_name").on(table.name),
  }),
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: text("id").primaryKey().notNull(),
    amount: real("amount").notNull(),
    transactionDate: integer("transaction_date").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    recurringTransactionId: text("recurring_transaction_id"),
    verified: integer("verified").notNull().default(0),
    notes: text("notes"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    dateIdx: index("idx_transactions_date").on(table.transactionDate),
    categoryIdx: index("idx_transactions_category").on(table.category),
    recurringIdx: index("idx_transactions_recurring").on(table.recurringTransactionId),
    verifiedIdx: index("idx_transactions_verified").on(table.verified),
  }),
);

export const recurringTransactions = sqliteTable(
  "recurring_transactions",
  {
    id: text("id").primaryKey().notNull(),
    amount: real("amount").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    startDate: integer("start_date").notNull(),
    lastCharged: integer("last_charged"),
    recurrenceValue: text("recurrence_value").notNull(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => ({
    dateIdx: index("idx_recurring_transactions_date").on(table.startDate),
    categoryIdx: index("idx_recurring_transactions_category").on(table.category),
    lastChargedIdx: index("idx_recurring_transactions_last_charged").on(table.lastCharged),
  }),
);

export const settings = sqliteTable(
  "settings",
  {
    key: text("key").primaryKey().notNull(),
    value: text("value").notNull(),
  }
);

// Types
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

// Zod schemas for validation (optional, but useful)
import { z } from "zod";

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  is_preset: z.boolean(),
  sort_order: z.number(),
  createdAt: z.number(),
});

export const TransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  transactionDate: z.number(),
  description: z.string(),
  category: z.string(),
  recurringTransactionId: z.string().optional(),
  verified: z.number().min(0).max(1),
  notes: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const RecurringTransactionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  description: z.string(),
  category: z.string(),
  startDate: z.number(),
  lastCharged: z.number().optional(),
  recurrenceValue: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const SettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});
