/** @jest-environment node */

import { DatabaseSync } from 'node:sqlite';
import type * as SQLite from 'expo-sqlite';

import { runSchemaMigrations } from '@/db/schema-migrations';
import { DATABASE_SCHEMA_SQL } from '@/db/schema-sql';
import {
  DatabaseRollbackError,
  detectBackupSchemaVersion,
  restoreRecognizedBackup,
  withRecoverySnapshot,
  V2_REQUIRED_COLUMNS,
  V3_REQUIRED_COLUMNS,
} from '../backup-core';

type SerializableDatabaseSync = DatabaseSync & {
  serialize: () => Uint8Array;
  deserialize: (data: Uint8Array) => void;
};

class ExpoSQLiteSyncAdapter {
  constructor(readonly database: SerializableDatabaseSync) {}

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
    return this.database.prepare(sql).run(...params);
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

const V2_SCHEMA_SQL = `
  CREATE TABLE categories (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL UNIQUE, icon TEXT NOT NULL, color TEXT NOT NULL, is_preset INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE transactions (id TEXT PRIMARY KEY NOT NULL, amount REAL NOT NULL, transaction_date INTEGER NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, recurring_transaction_id TEXT, verified INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE recurring_transactions (id TEXT PRIMARY KEY NOT NULL, amount REAL NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, start_date INTEGER NOT NULL, last_charged INTEGER, recurrence_value TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
  PRAGMA user_version = 2;
`;

const columnsFrom = (database: DatabaseSync) => Object.fromEntries(
  database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map(({ name }) => [
      name,
      database.prepare(`PRAGMA table_info(${String(name)})`).all().map(({ name: column }) => String(column)),
    ]),
);

const userVersionFrom = (database: DatabaseSync) =>
  Number((database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version);

const detectDatabaseVersion = (database: DatabaseSync) =>
  detectBackupSchemaVersion(columnsFrom(database), userVersionFrom(database));

const createV2Database = () => {
  const database = new DatabaseSync(':memory:');
  database.exec(V2_SCHEMA_SQL);
  database.prepare('INSERT INTO recurring_transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('rule-1', -20, 'Rent', 'Bills', 100, 150, '0 0 1 * *', 10, 20);
  database.prepare('INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run('tx-1', -20, 150, 'Rent', 'Bills', 'rule-1', 1, 'private note', 11, 12);
  return new ExpoSQLiteSyncAdapter(database as SerializableDatabaseSync);
};

const createV3Database = (label: string) => {
  const database = new DatabaseSync(':memory:');
  database.exec(DATABASE_SCHEMA_SQL);
  database.prepare('INSERT INTO transaction_templates VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(`${label}-template`, `${label} template`, `${label} template`, 10, 'expense', label, 'Other', null, 0, null, null, null, 0, null, 1, 1);
  database.prepare('INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(`${label}-tx`, -10, 1, label, 'Other', `${label}-template`, 0, null, null, 1, 1);
  return new ExpoSQLiteSyncAdapter(database as SerializableDatabaseSync);
};

const createEmptyDatabase = () => new ExpoSQLiteSyncAdapter(
  new DatabaseSync(':memory:') as SerializableDatabaseSync,
);

const copyDatabase = jest.fn(async (
  source: ExpoSQLiteSyncAdapter,
  destination: ExpoSQLiteSyncAdapter,
) => {
  destination.database.deserialize(source.database.serialize());
});

const validateIntegrity = (database: ExpoSQLiteSyncAdapter) => {
  const result = database.database.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
  if (result.integrity_check !== 'ok') throw new Error('integrity failure');
};

const validateV3 = (database: ExpoSQLiteSyncAdapter) => {
  if (detectDatabaseVersion(database.database) !== 3) throw new Error('destination is not exact V3');
};

const closeAll = (...adapters: ExpoSQLiteSyncAdapter[]) => {
  for (const adapter of adapters) adapter.database.close();
};

describe('recovery snapshot lifecycle', () => {
  const createHooks = () => {
    const calls: string[] = [];
    const recovery = { kind: 'recovery' };
    return {
      calls,
      recovery,
      hooks: {
        removeStaleRecovery: jest.fn(async () => { calls.push('remove_stale'); }),
        openRecovery: jest.fn(() => { calls.push('open'); return recovery; }),
        closeRecovery: jest.fn(async () => { calls.push('close'); }),
        deleteRecovery: jest.fn(async () => { calls.push('delete'); }),
      },
    };
  };

  afterEach(() => jest.restoreAllMocks());

  it('removes stale recovery first, then closes and deletes after success', async () => {
    const { calls, recovery, hooks } = createHooks();

    await expect(withRecoverySnapshot({
      ...hooks,
      operation: async (opened) => {
        calls.push('operation');
        expect(opened).toBe(recovery);
        return 'restored';
      },
    })).resolves.toBe('restored');

    expect(calls).toEqual(['remove_stale', 'open', 'operation', 'close', 'delete']);
  });

  it('closes and deletes after the original failure was rolled back successfully', async () => {
    const { calls, hooks } = createHooks();

    await expect(withRecoverySnapshot({
      ...hooks,
      operation: async () => {
        calls.push('operation');
        throw new Error('original replacement failure');
      },
    })).rejects.toThrow('original replacement failure');

    expect(calls).toEqual(['remove_stale', 'open', 'operation', 'close', 'delete']);
  });

  it('always closes but preserves the recovery file after rollback failure', async () => {
    const { calls, hooks } = createHooks();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const rollbackFailure = new DatabaseRollbackError(
      new Error('replacement details must not be logged'),
      new TypeError('rollback details must not be logged'),
    );

    await expect(withRecoverySnapshot({
      ...hooks,
      operation: async () => {
        calls.push('operation');
        throw rollbackFailure;
      },
    })).rejects.toBe(rollbackFailure);

    expect(calls).toEqual(['remove_stale', 'open', 'operation', 'close']);
    expect(hooks.deleteRecovery).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(
      '[backup.restore][stage=preserve_recovery] preserving recovery after rollback failure',
      {
        recovery_preserved: true,
        restore_error_type: 'Error',
        rollback_error_type: 'TypeError',
      },
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain('details must not be logged');
  });
});

describe('backup schema compatibility', () => {
  beforeEach(() => copyDatabase.mockClear());
  afterEach(() => jest.restoreAllMocks());

  it('recognizes exact shape and supported PRAGMA user_version pairs only', () => {
    expect(detectBackupSchemaVersion(V3_REQUIRED_COLUMNS, 3)).toBe(3);
    expect(detectBackupSchemaVersion(V3_REQUIRED_COLUMNS, 0)).toBeNull();
    expect(detectBackupSchemaVersion(V3_REQUIRED_COLUMNS, 2)).toBeNull();
    expect(detectBackupSchemaVersion(V3_REQUIRED_COLUMNS, 4)).toBeNull();
    expect(detectBackupSchemaVersion(V2_REQUIRED_COLUMNS, 0)).toBe(2);
    expect(detectBackupSchemaVersion(V2_REQUIRED_COLUMNS, 2)).toBe(2);
    expect(detectBackupSchemaVersion(V2_REQUIRED_COLUMNS, 3)).toBeNull();
    expect(detectBackupSchemaVersion(V2_REQUIRED_COLUMNS, 4)).toBeNull();
  });

  it('rejects missing, mixed, and extra columns even with a supported version', () => {
    expect(detectBackupSchemaVersion({
      ...V3_REQUIRED_COLUMNS,
      transactions: V3_REQUIRED_COLUMNS.transactions.filter((column) => column !== 'deleted_at'),
    }, 3)).toBeNull();
    expect(detectBackupSchemaVersion({
      ...V3_REQUIRED_COLUMNS,
      transactions: V3_REQUIRED_COLUMNS.transactions.filter((column) => column !== 'template_id'),
    }, 3)).toBeNull();
    expect(detectBackupSchemaVersion({
      ...V3_REQUIRED_COLUMNS,
      transaction_templates: [...V3_REQUIRED_COLUMNS.transaction_templates, 'unexpected'],
    }, 3)).toBeNull();
    expect(detectBackupSchemaVersion({
      ...V2_REQUIRED_COLUMNS,
      transactions: V3_REQUIRED_COLUMNS.transactions,
    }, 2)).toBeNull();
  });

  it('uses separate databases to restore V3 directly and validates the destination', async () => {
    const source = createV3Database('source');
    source.database.prepare('UPDATE transactions SET deleted_at = 123').run();
    source.database.prepare('UPDATE transaction_templates SET deleted_at = 456').run();
    const destination = createV3Database('original');
    const recovery = createEmptyDatabase();
    const migrate = jest.fn();

    await expect(restoreRecognizedBackup({
      sourceVersion: 3,
      source,
      destination,
      recovery,
      copyDatabase,
      migrate,
      validateDestination: validateV3,
      validateRecovery: validateIntegrity,
    })).resolves.toEqual({ mode: 'restore', sourceVersion: 3 });

    expect(destination.database.prepare('SELECT id, template_id, deleted_at FROM transactions').all()).toEqual([
      { id: 'source-tx', template_id: 'source-template', deleted_at: 123 },
    ]);
    expect(destination.database.prepare('SELECT id, deleted_at FROM transaction_templates').all()).toEqual([
      { id: 'source-template', deleted_at: 456 },
    ]);
    expect(migrate).not.toHaveBeenCalled();
    expect(copyDatabase).toHaveBeenCalledTimes(2);
    closeAll(source, destination, recovery);
  });

  it('uses separate databases and real copy semantics before migrating V2 links', async () => {
    const source = createV2Database();
    const destination = createV3Database('original');
    const recovery = createEmptyDatabase();

    await expect(restoreRecognizedBackup({
      sourceVersion: 2,
      source,
      destination,
      recovery,
      copyDatabase,
      migrate: (database) => runSchemaMigrations(asExpoDatabase(database)),
      validateDestination: validateV3,
      validateRecovery: validateIntegrity,
    })).resolves.toEqual({ mode: 'migrate', sourceVersion: 2 });

    expect(destination.database.prepare('SELECT id, template_id, deleted_at FROM transactions').all()).toEqual([
      { id: 'tx-1', template_id: 'rule-1', deleted_at: null },
    ]);
    expect(destination.database.prepare('SELECT id, deleted_at FROM transaction_templates').all()).toEqual([
      { id: 'rule-1', deleted_at: null },
    ]);
    expect(detectDatabaseVersion(destination.database)).toBe(3);
    expect(copyDatabase).toHaveBeenCalledTimes(2);
    closeAll(source, destination, recovery);
  });

  it('restores the original live schema and data after V2 post-copy migration fails', async () => {
    const source = createV2Database();
    const destination = createV3Database('original');
    const recovery = createEmptyDatabase();

    await expect(restoreRecognizedBackup({
      sourceVersion: 2,
      source,
      destination,
      recovery,
      copyDatabase,
      migrate: () => { throw new Error('forced migration failure'); },
      validateDestination: validateV3,
      validateRecovery: validateIntegrity,
    })).rejects.toThrow('forced migration failure');

    expect(detectDatabaseVersion(destination.database)).toBe(3);
    expect(destination.database.prepare('SELECT id, description FROM transactions').all()).toEqual([
      { id: 'original-tx', description: 'original' },
    ]);
    expect(copyDatabase).toHaveBeenCalledTimes(3);
    closeAll(source, destination, recovery);
  });

  it('rolls back a replacement copy that mutates the destination and then fails', async () => {
    const source = createV3Database('source');
    const destination = createV3Database('original');
    const recovery = createEmptyDatabase();
    const failingCopy = jest.fn(async (
      from: ExpoSQLiteSyncAdapter,
      to: ExpoSQLiteSyncAdapter,
    ) => {
      to.database.deserialize(from.database.serialize());
      if (from === source && to === destination) throw new Error('forced copy failure');
    });

    await expect(restoreRecognizedBackup({
      sourceVersion: 3,
      source,
      destination,
      recovery,
      copyDatabase: failingCopy,
      migrate: jest.fn(),
      validateDestination: validateV3,
      validateRecovery: validateIntegrity,
    })).rejects.toThrow('forced copy failure');

    expect(destination.database.prepare('SELECT id FROM transactions').all()).toEqual([
      { id: 'original-tx' },
    ]);
    expect(failingCopy).toHaveBeenCalledTimes(3);
    closeAll(source, destination, recovery);
  });

  it('logs rollback stage and safely surfaces replacement and rollback failures', async () => {
    const source = createV3Database('source');
    const destination = createV3Database('original');
    const recovery = createEmptyDatabase();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const failingCopy = jest.fn(async (
      from: ExpoSQLiteSyncAdapter,
      to: ExpoSQLiteSyncAdapter,
    ) => {
      if (from === recovery && to === destination) throw new Error('forced rollback failure');
      to.database.deserialize(from.database.serialize());
      if (from === source && to === destination) throw new Error('forced replacement failure');
    });

    const promise = restoreRecognizedBackup({
      sourceVersion: 3,
      source,
      destination,
      recovery,
      copyDatabase: failingCopy,
      migrate: jest.fn(),
      validateDestination: validateV3,
      validateRecovery: validateIntegrity,
    });

    await expect(promise).rejects.toBeInstanceOf(DatabaseRollbackError);
    await expect(promise).rejects.toThrow('forced replacement failure');
    await expect(promise).rejects.toThrow('forced rollback failure');
    expect(errorLog).toHaveBeenCalledWith(
      '[backup.restore][stage=rollback] live database rollback failed',
      {
        restore_error: 'Error: forced replacement failure',
        rollback_error: 'Error: forced rollback failure',
      },
    );
    closeAll(source, destination, recovery);
  });
});
