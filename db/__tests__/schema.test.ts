/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { transactionTemplates } from '../schema';
import { DATABASE_NAME, DATABASE_SCHEMA_SQL } from '../schema-sql';

describe('latest database schema', () => {
  it('uses a separate file from the legacy database', () => {
    expect(DATABASE_NAME).toBe('expense_tracker_v2.db');
    expect(DATABASE_NAME).not.toBe('expense_tracker.db');
  });

  it('creates required tables, columns, and indexes', () => {
    const database = new DatabaseSync(':memory:');
    database.exec(DATABASE_SCHEMA_SQL);

    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row.name);
    const transactionColumns = database
      .prepare('PRAGMA table_info(transactions)')
      .all()
      .map((row) => row.name);
    const templateColumns = database
      .prepare('PRAGMA table_info(transaction_templates)')
      .all()
      .map((row) => row.name);
    const indexes = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex_%'")
      .all()
      .map((row) => row.name);

    expect(tables).toEqual(['categories', 'settings', 'transaction_templates', 'transactions']);
    expect(transactionColumns).toEqual([
      'id',
      'amount',
      'transaction_date',
      'description',
      'category',
      'template_id',
      'verified',
      'notes',
      'deleted_at',
      'created_at',
      'updated_at',
    ]);
    expect(templateColumns).toEqual([
      'id',
      'name',
      'normalized_name',
      'amount',
      'transaction_type',
      'description',
      'category',
      'notes',
      'verified',
      'recurrence_value',
      'start_date',
      'schedule_cursor_at',
      'schedule_active',
      'deleted_at',
      'created_at',
      'updated_at',
    ]);
    expect(indexes).toEqual(expect.arrayContaining([
      'idx_categories_name',
      'idx_transactions_date',
      'idx_transactions_category',
      'idx_transactions_template',
      'idx_transactions_verified',
      'idx_transactions_deleted',
      'idx_templates_active_name',
      'idx_templates_category',
      'idx_templates_schedule',
    ]));
    expect(database.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });

    database.close();
  });

  it('declares the same template checks in the Drizzle schema', () => {
    expect(getTableConfig(transactionTemplates).checks.map(({ name }) => name).sort()).toEqual([
      'chk_templates_active_schedule',
      'chk_templates_amount',
      'chk_templates_manual_schedule',
      'chk_templates_reusable_field',
      'chk_templates_schedule_active',
      'chk_templates_transaction_type',
      'chk_templates_verified',
    ]);
  });

  it('enforces template invariants while allowing incomplete paused legacy schedules', () => {
    const database = new DatabaseSync(':memory:');
    database.exec(DATABASE_SCHEMA_SQL);
    const insert = database.prepare(`
      INSERT INTO transaction_templates (
        id, name, normalized_name, amount, transaction_type, description, category,
        notes, verified, recurrence_value, start_date, schedule_cursor_at,
        schedule_active, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, 1)
    `);
    const row = (overrides: Partial<{
      id: string;
      amount: number | null;
      transactionType: string | null;
      description: string | null;
      category: string | null;
      notes: string | null;
      verified: number | null;
      recurrenceValue: string | null;
      startDate: number | null;
      cursor: number | null;
      active: number;
    }> = {}) => ({
      id: 'template',
      amount: 10,
      transactionType: 'expense',
      description: 'Description',
      category: null,
      notes: null,
      verified: null,
      recurrenceValue: null,
      startDate: null,
      cursor: null,
      active: 0,
      ...overrides,
    });
    const run = (value: ReturnType<typeof row>) => insert.run(
      value.id,
      value.id,
      value.id,
      value.amount,
      value.transactionType,
      value.description,
      value.category,
      value.notes,
      value.verified,
      value.recurrenceValue,
      value.startDate,
      value.cursor,
      value.active,
    );

    expect(() => run(row({ id: 'zero', amount: 0 }))).toThrow(/chk_templates_amount/);
    expect(() => run(row({ id: 'infinite', amount: Number.POSITIVE_INFINITY }))).toThrow(/chk_templates_amount/);
    expect(() => run(row({
      id: 'empty', amount: null, transactionType: null, description: null,
    }))).toThrow(/chk_templates_reusable_field/);
    expect(() => run(row({
      id: 'manual-with-cursor', recurrenceValue: null, startDate: 1, cursor: 1,
    }))).toThrow(/chk_templates_manual_schedule/);
    expect(() => run(row({
      id: 'active-incomplete', recurrenceValue: '0 0 1 * *', startDate: 1,
      cursor: 1, active: 1, description: '   ',
    }))).toThrow(/chk_templates_active_schedule/);

    expect(() => run(row({
      id: 'paused-incomplete', amount: null, transactionType: null,
      description: '   ', category: null, recurrenceValue: 'not a cron',
      startDate: 1.5, cursor: null, active: 0,
    }))).not.toThrow();
    expect(database.prepare('SELECT schedule_active FROM transaction_templates WHERE id = ?')
      .get('paused-incomplete')).toEqual({ schedule_active: 0 });
    database.close();
  });

  it('preserves 2,246 imported rows including duplicate recurrence dates', () => {
    const database = new DatabaseSync(':memory:');
    database.exec(DATABASE_SCHEMA_SQL);
    const insert = database.prepare('INSERT INTO transactions (id, amount, transaction_date, description, category, template_id, verified, notes, deleted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    database.exec('BEGIN');
    for (let index = 1; index <= 2246; index += 1) {
      insert.run(`legacy-${index}`, -index, index <= 2 ? 1776528000000 : index, `Expense ${index}`, 'Other', index <= 2 ? 'legacy-rule-1' : null, 0, null, null, index, index);
    }
    database.exec('COMMIT');
    expect(database.prepare('SELECT count(*) AS count FROM transactions').get()).toEqual({ count: 2246 });
    expect(database.prepare('SELECT count(*) AS count FROM transactions WHERE template_id = ? AND transaction_date = ?').get('legacy-rule-1', 1776528000000)).toEqual({ count: 2 });
    database.close();
  });
});
