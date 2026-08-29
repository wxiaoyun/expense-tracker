/** @jest-environment node */

import { DatabaseSync, type StatementSync } from 'node:sqlite';
import type * as SQLite from 'expo-sqlite';
import { LATEST_SCHEMA_VERSION, runSchemaMigrations } from '../schema-migrations';

const V2_SCHEMA_SQL = `
  CREATE TABLE categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    is_preset INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE transactions (
    id TEXT PRIMARY KEY NOT NULL,
    amount REAL NOT NULL,
    transaction_date INTEGER NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    recurring_transaction_id TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE recurring_transactions (
    id TEXT PRIMARY KEY NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    start_date INTEGER NOT NULL,
    last_charged INTEGER,
    recurrence_value TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  PRAGMA user_version = 2;
`;

class ExpoSQLiteSyncAdapter {
  constructor(
    readonly database: DatabaseSync,
    private readonly failRun?: (sql: string) => boolean,
  ) {}

  execSync(sql: string) {
    this.database.exec(sql);
  }

  getFirstSync<T>(sql: string, ...params: any[]): T | null {
    return (this.database.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  getAllSync<T>(sql: string, ...params: any[]): T[] {
    return this.database.prepare(sql).all(...params) as T[];
  }

  runSync(sql: string, ...params: any[]) {
    if (this.failRun?.(sql)) throw new Error('forced insert failure');
    return this.database.prepare(sql).run(...params);
  }

  prepareSync(sql: string): StatementSync {
    return this.database.prepare(sql);
  }

  withTransactionSync(task: () => void) {
    this.database.exec('BEGIN');
    try {
      task();
      this.database.exec('COMMIT');
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

const asExpoDatabase = (adapter: ExpoSQLiteSyncAdapter) =>
  adapter as unknown as SQLite.SQLiteDatabase;

const createV2Database = () => {
  const database = new DatabaseSync(':memory:');
  database.exec(V2_SCHEMA_SQL);
  database.prepare('INSERT INTO recurring_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('rule-1', -20, 'Netflix', 'Bills', 100, 150, '0 0 1 * *', 10, 20);
  database.prepare('INSERT INTO recurring_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('rule-2', 200, 'Salary', 'Income', 200, null, '0 0 1 * *', 30, 40);
  database.prepare('INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('tx-1', -20, 150, 'Netflix', 'Bills', 'rule-1', 1, 'first', 11, 12);
  database.prepare('INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('tx-2', 200, 200, 'Salary', 'Income', 'rule-2', 0, null, 31, 32);
  return database;
};

describe('latest schema migration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('atomically migrates V2 recurring rules and linked transactions', () => {
    const database = createV2Database();

    runSchemaMigrations(asExpoDatabase(new ExpoSQLiteSyncAdapter(database)));

    expect(database.prepare('SELECT count(*) AS count FROM transaction_templates').get()).toEqual({ count: 2 });
    expect(database.prepare('SELECT id, amount, transaction_type, schedule_cursor_at FROM transaction_templates ORDER BY id').all()).toEqual([
      { id: 'rule-1', amount: 20, transaction_type: 'expense', schedule_cursor_at: 150 },
      { id: 'rule-2', amount: 200, transaction_type: 'income', schedule_cursor_at: 200 },
    ]);
    expect(database.prepare('SELECT template_id FROM transactions ORDER BY id').all()).toEqual([
      { template_id: 'rule-1' },
      { template_id: 'rule-2' },
    ]);
    expect(database.prepare('SELECT notes, deleted_at FROM transactions ORDER BY id').all()).toEqual([
      { notes: 'first', deleted_at: null },
      { notes: null, deleted_at: null },
    ]);
    expect(database.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='recurring_transactions'").get()).toBeUndefined();

    runSchemaMigrations(asExpoDatabase(new ExpoSQLiteSyncAdapter(database)));
    expect(database.prepare('SELECT count(*) AS count FROM transaction_templates').get()).toEqual({ count: 2 });
    expect(database.prepare('PRAGMA user_version').get()).toEqual({ user_version: LATEST_SCHEMA_VERSION });
    database.close();
  });

  it('preserves whitespace-only and zero-valued V2 rules with every link', () => {
    const database = createV2Database();
    database.prepare('INSERT INTO recurring_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('rule-3', -30, '   ', 'Bills', 300, null, '0 0 1 * *', 50, 60);
    database.prepare('INSERT INTO recurring_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('rule-4', 0, '\t', 'Other', 400, 450, '0 0 1 * *', 70, 80);
    database.prepare('INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('tx-3', -30, 300, 'Whitespace one', 'Bills', 'rule-3', 0, null, 51, 52);
    database.prepare('INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run('tx-4', 0, 450, 'Whitespace zero', 'Other', 'rule-4', 0, null, 71, 72);

    runSchemaMigrations(asExpoDatabase(new ExpoSQLiteSyncAdapter(database)));

    expect(database.prepare('SELECT count(*) AS count FROM transaction_templates').get()).toEqual({ count: 4 });
    expect(database.prepare(`
      SELECT id, name, description, amount, transaction_type, schedule_cursor_at, schedule_active
      FROM transaction_templates
      WHERE id IN ('rule-3', 'rule-4')
      ORDER BY id
    `).all()).toEqual([
      {
        id: 'rule-3',
        name: 'Template rule-3',
        description: '   ',
        amount: 30,
        transaction_type: 'expense',
        schedule_cursor_at: 300,
        schedule_active: 1,
      },
      {
        id: 'rule-4',
        name: 'Template rule-4',
        description: '\t',
        amount: null,
        transaction_type: null,
        schedule_cursor_at: 450,
        schedule_active: 0,
      },
    ]);
    expect(database.prepare('SELECT id, template_id FROM transactions ORDER BY id').all()).toEqual([
      { id: 'tx-1', template_id: 'rule-1' },
      { id: 'tx-2', template_id: 'rule-2' },
      { id: 'tx-3', template_id: 'rule-3' },
      { id: 'tx-4', template_id: 'rule-4' },
    ]);
    expect(database.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });
    database.close();
  });

  it('creates the latest schema atomically for a fresh database', () => {
    const database = new DatabaseSync(':memory:');

    runSchemaMigrations(asExpoDatabase(new ExpoSQLiteSyncAdapter(database)));

    expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()).toEqual([
      { name: 'categories' },
      { name: 'settings' },
      { name: 'transaction_templates' },
      { name: 'transactions' },
    ]);
    expect(database.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });
    database.close();
  });

  it('migrates the shipped unversioned V2 schema by inspecting its tables', () => {
    const database = createV2Database();
    database.exec('PRAGMA user_version = 0');

    runSchemaMigrations(asExpoDatabase(new ExpoSQLiteSyncAdapter(database)));

    expect(database.prepare('SELECT count(*) AS count FROM transaction_templates').get()).toEqual({ count: 2 });
    expect(database.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });
    database.close();
  });

  it('refuses to version or use a partial V2 schema', () => {
    const database = createV2Database();
    database.exec('DROP TABLE settings');
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => runSchemaMigrations(
      asExpoDatabase(new ExpoSQLiteSyncAdapter(database)),
    )).toThrow('V2 database is missing required table: settings');

    expect(database.prepare('PRAGMA user_version').get()).toEqual({ user_version: 2 });
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transaction_templates'").get()).toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith(
      '[db.schema_migration] migration failed',
      expect.objectContaining({ stage: 'verify_v2_schema', from_version: 2, to_version: 3 }),
    );
    database.close();
  });

  it('rolls back every schema change when a mapped insert fails', () => {
    const database = createV2Database();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const adapter = new ExpoSQLiteSyncAdapter(
      database,
      (sql) => sql.includes('INSERT INTO transaction_templates'),
    );

    expect(() => runSchemaMigrations(asExpoDatabase(adapter))).toThrow('forced insert failure');

    expect(database.prepare('PRAGMA user_version').get()).toEqual({ user_version: 2 });
    expect(database.prepare('SELECT count(*) AS count FROM recurring_transactions').get()).toEqual({ count: 2 });
    expect(database.prepare('SELECT recurring_transaction_id FROM transactions ORDER BY id').all()).toEqual([
      { recurring_transaction_id: 'rule-1' },
      { recurring_transaction_id: 'rule-2' },
    ]);
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transaction_templates'").get()).toBeUndefined();
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='transactions_v3'").get()).toBeUndefined();
    expect(errorLog).toHaveBeenCalledWith(
      '[db.schema_migration] migration failed',
      expect.objectContaining({
        stage: 'insert_templates',
        from_version: 2,
        to_version: 3,
        error: 'Error: forced insert failure',
      }),
    );
    database.close();
  });
});
