import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { z } from 'zod';

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull().unique(),
    icon: text('icon').notNull(),
    color: text('color').notNull(),
    is_preset: integer('is_preset', { mode: 'boolean' }).notNull().default(false),
    sort_order: integer('sort_order').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => ({
    nameIdx: index('idx_categories_name').on(table.name),
  }),
);

export const transactionTemplates = sqliteTable(
  'transaction_templates',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    amount: real('amount'),
    transactionType: text('transaction_type').$type<'income' | 'expense'>(),
    description: text('description'),
    category: text('category'),
    notes: text('notes'),
    verified: integer('verified'),
    recurrenceValue: text('recurrence_value'),
    startDate: integer('start_date'),
    scheduleCursorAt: integer('schedule_cursor_at'),
    scheduleActive: integer('schedule_active').notNull().default(0),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    activeNameIdx: uniqueIndex('idx_templates_active_name')
      .on(table.normalizedName)
      .where(sql`${table.deletedAt} IS NULL`),
    categoryIdx: index('idx_templates_category').on(table.category),
    scheduleIdx: index('idx_templates_schedule').on(table.scheduleActive, table.deletedAt),
  }),
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: text('id').primaryKey().notNull(),
    amount: real('amount').notNull(),
    transactionDate: integer('transaction_date').notNull(),
    description: text('description').notNull(),
    category: text('category').notNull(),
    templateId: text('template_id'),
    verified: integer('verified').notNull().default(0),
    notes: text('notes'),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    dateIdx: index('idx_transactions_date').on(table.transactionDate),
    categoryIdx: index('idx_transactions_category').on(table.category),
    templateIdx: index('idx_transactions_template').on(table.templateId),
    verifiedIdx: index('idx_transactions_verified').on(table.verified),
    deletedIdx: index('idx_transactions_deleted').on(table.deletedAt),
  }),
);

export const settings = sqliteTable(
  'settings',
  {
    key: text('key').primaryKey().notNull(),
    value: text('value').notNull(),
  },
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionTemplate = typeof transactionTemplates.$inferSelect;
export type NewTransactionTemplate = typeof transactionTemplates.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

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
  templateId: z.string().nullable(),
  verified: z.number().min(0).max(1),
  notes: z.string().nullable(),
  deletedAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const TransactionTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  normalizedName: z.string(),
  amount: z.number().nullable(),
  transactionType: z.enum(['income', 'expense']).nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  notes: z.string().nullable(),
  verified: z.number().min(0).max(1).nullable(),
  recurrenceValue: z.string().nullable(),
  startDate: z.number().nullable(),
  scheduleCursorAt: z.number().nullable(),
  scheduleActive: z.number().min(0).max(1),
  deletedAt: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const SettingSchema = z.object({
  key: z.string(),
  value: z.string(),
});
