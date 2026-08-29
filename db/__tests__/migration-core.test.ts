/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';
import {
  generateMigrationUUID,
  mapLegacyRecurring,
  mapLegacyTransaction,
  splitIntoMigrationBatches,
} from '../migration-core';
import { DATABASE_SCHEMA_SQL } from '../schema-sql';

describe('migration core', () => {
  it('maps legacy IDs to stable UUIDs', () => {
    expect(generateMigrationUUID(42)).toBe(generateMigrationUUID(42));
    expect(generateMigrationUUID(42)).not.toBe(generateMigrationUUID(43));
    expect(generateMigrationUUID(42)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('maps every legacy transaction field and template reference', () => {
    expect(mapLegacyTransaction({
      id: 7,
      amount: -12.5,
      transaction_date: 1700000000000,
      description: 'Lunch',
      category: 'Food',
      recurring_transaction_id: 3,
      verified: 1,
      created_at: 1700000000001,
      updated_at: 1700000000002,
    })).toEqual({
      id: generateMigrationUUID(7),
      amount: -12.5,
      transactionDate: 1700000000000,
      description: 'Lunch',
      category: 'Food',
      templateId: generateMigrationUUID(3),
      verified: 1,
      notes: null,
      deletedAt: null,
      createdAt: 1700000000001,
      updatedAt: 1700000000002,
    });
  });

  it('maps legacy recurring rows to positive scheduled templates', () => {
    expect(mapLegacyRecurring({
      id: 9,
      amount: -99,
      description: 'Internet',
      category: 'Bills',
      start_date: 1700000000000,
      last_charged: null,
      recurrence_value: '0 0 1 * *',
      created_at: 1700000000001,
      updated_at: 1700000000002,
    }, new Set())).toEqual({
      id: generateMigrationUUID(9),
      name: 'Internet',
      normalizedName: 'internet',
      amount: 99,
      transactionType: 'expense',
      description: 'Internet',
      category: 'Bills',
      notes: null,
      verified: null,
      recurrenceValue: '0 0 1 * *',
      startDate: 1700000000000,
      scheduleCursorAt: 1700000000000,
      scheduleActive: 1,
      deletedAt: null,
      createdAt: 1700000000001,
      updatedAt: 1700000000002,
    });
  });

  it.each([
    { label: 'blank description', amount: -10, description: '   ', start: 10, cursor: 10, cron: '0 0 1 * *' },
    { label: 'zero amount', amount: 0, description: 'Zero', start: 10, cursor: 10, cron: '0 0 1 * *' },
    { label: 'invalid cron', amount: -10, description: 'Cron', start: 10, cursor: 10, cron: 'not a cron' },
    { label: 'invalid start', amount: -10, description: 'Start', start: 10.5, cursor: null, cron: '0 0 1 * *' },
    { label: 'invalid cursor', amount: -10, description: 'Cursor', start: 20, cursor: 10, cron: '0 0 1 * *' },
  ])('pauses integer-ID legacy rules with $label', ({ amount, description, start, cursor, cron }) => {
    expect(mapLegacyRecurring({
      id: 90,
      amount,
      description,
      category: 'Other',
      start_date: start,
      last_charged: cursor,
      recurrence_value: cron,
      created_at: 1,
      updated_at: 2,
    }, new Set())).toEqual(expect.objectContaining({
      description,
      recurrenceValue: cron,
      startDate: start,
      scheduleCursorAt: cursor ?? start,
      scheduleActive: 0,
    }));
  });

  it('suffixes duplicate legacy template names across batches', () => {
    const activeNames = new Set<string>();
    const source = {
      amount: -10,
      category: 'Bills',
      start_date: 1,
      last_charged: null,
      recurrence_value: '0 0 1 * *',
      created_at: 1,
      updated_at: 1,
    };

    const first = mapLegacyRecurring({ ...source, id: 1, description: ' Netflix ' }, activeNames);
    const second = mapLegacyRecurring({ ...source, id: 2, description: 'netflix' }, activeNames);

    expect([first.name, second.name]).toEqual(['Netflix', 'netflix 2']);
    expect(activeNames).toEqual(new Set(['netflix', 'netflix 2']));
  });

  it('preserves whitespace-only legacy rules and every generated source link', () => {
    const activeNames = new Set<string>();
    const recurringRows = [
      { id: 21, amount: -10, description: '   ', category: 'Bills', start_date: 1, last_charged: null, recurrence_value: '0 0 1 * *', created_at: 1, updated_at: 1 },
      { id: 22, amount: -20, description: '\t', category: 'Bills', start_date: 2, last_charged: 3, recurrence_value: '0 0 1 * *', created_at: 2, updated_at: 2 },
    ];
    const transactionRows = [
      { id: 31, amount: -10, transaction_date: 1, description: 'first', category: 'Bills', recurring_transaction_id: 21, verified: 0, created_at: 1, updated_at: 1 },
      { id: 32, amount: -20, transaction_date: 2, description: 'second', category: 'Bills', recurring_transaction_id: 22, verified: 0, created_at: 2, updated_at: 2 },
    ];

    const templates = recurringRows.map((row) => mapLegacyRecurring(row, activeNames));
    const transactions = transactionRows.map(mapLegacyTransaction);

    expect(templates.map(({ id, name, description }) => ({ id, name, description }))).toEqual([
      { id: generateMigrationUUID(21), name: `Template ${generateMigrationUUID(21)}`, description: '   ' },
      { id: generateMigrationUUID(22), name: `Template ${generateMigrationUUID(22)}`, description: '\t' },
    ]);
    expect(transactions.map(({ templateId }) => templateId)).toEqual(templates.map(({ id }) => id));
    expect(new Set(templates.map(({ normalizedName }) => normalizedName)).size).toBe(2);

    const database = new DatabaseSync(':memory:');
    database.exec(DATABASE_SCHEMA_SQL);
    const insertTemplate = database.prepare(`
      INSERT INTO transaction_templates (
        id, name, normalized_name, amount, transaction_type, description, category,
        notes, verified, recurrence_value, start_date, schedule_cursor_at,
        schedule_active, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTransaction = database.prepare(`
      INSERT INTO transactions (
        id, amount, transaction_date, description, category, template_id,
        verified, notes, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const template of templates) {
      insertTemplate.run(
        template.id, template.name, template.normalizedName, template.amount,
        template.transactionType, template.description, template.category,
        template.notes, template.verified, template.recurrenceValue,
        template.startDate, template.scheduleCursorAt, template.scheduleActive,
        template.deletedAt, template.createdAt, template.updatedAt,
      );
    }
    for (const transaction of transactions) {
      insertTransaction.run(
        transaction.id, transaction.amount, transaction.transactionDate,
        transaction.description, transaction.category, transaction.templateId,
        transaction.verified, transaction.notes, transaction.deletedAt,
        transaction.createdAt, transaction.updatedAt,
      );
    }

    expect(database.prepare('SELECT count(*) AS count FROM transaction_templates').get()).toEqual({ count: 2 });
    expect(database.prepare('SELECT count(*) AS count FROM transactions').get()).toEqual({ count: 2 });
    expect(database.prepare(`
      SELECT transactions.template_id
      FROM transactions
      JOIN transaction_templates ON transactions.template_id = transaction_templates.id
      ORDER BY transactions.id
    `).all()).toEqual(
      transactions
        .map(({ id, templateId }) => ({ id, template_id: templateId }))
        .sort((left, right) => left.id.localeCompare(right.id))
        .map(({ template_id }) => ({ template_id })),
    );
    database.close();
  });

  it('preserves and pauses zero-valued legacy rules and their links', () => {
    const template = mapLegacyRecurring({
      id: 40,
      amount: 0,
      description: 'Zero rule',
      category: 'Other',
      start_date: 100,
      last_charged: 200,
      recurrence_value: '0 0 1 * *',
      created_at: 10,
      updated_at: 20,
    }, new Set());
    const transaction = mapLegacyTransaction({
      id: 41,
      amount: 0,
      transaction_date: 200,
      description: 'Zero occurrence',
      category: 'Other',
      recurring_transaction_id: 40,
      verified: 0,
      created_at: 10,
      updated_at: 20,
    });

    expect(template).toEqual(expect.objectContaining({
      id: generateMigrationUUID(40),
      amount: null,
      transactionType: null,
      description: 'Zero rule',
      category: 'Other',
      recurrenceValue: '0 0 1 * *',
      startDate: 100,
      scheduleCursorAt: 200,
      scheduleActive: 0,
    }));
    expect(transaction.templateId).toBe(template.id);
  });

  it('preserves all 2,246 rows across 1,000-row batches', () => {
    const rows = Array.from({ length: 2246 }, (_, index) => index + 1);
    const batches = splitIntoMigrationBatches(rows, 1000);

    expect(batches.map((batch) => batch.length)).toEqual([1000, 1000, 246]);
    expect(batches.flat()).toEqual(rows);
  });
});
