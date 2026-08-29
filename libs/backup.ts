import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { DATABASE_NAME } from '@/db/schema-sql';
import { db, sqlite } from '@/db';
import { getLegacyDbPath, runMigration } from '@/db/migration';
import { runSchemaMigrations } from '@/db/schema-migrations';
import {
  backupFilename,
  detectBackupSchemaVersion,
  hasSqliteHeader,
  replaceDatabaseWithRecovery,
  restoreRecognizedBackup,
  withRecoverySnapshot,
  type BackupSchemaVersion,
} from './backup-core';

export const databasePath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
export const backupDirectory = `${FileSystem.documentDirectory}Backups/`;
const IMPORT_STAGING_NAME = 'expense_tracker_import_candidate.db';
const RESTORE_STAGING_NAME = 'expense_tracker_restore_candidate.db';
const RECOVERY_STAGING_NAME = 'expense_tracker_restore_recovery.db';
const sqliteDirectory = `${FileSystem.documentDirectory}SQLite/`;
const importStagingPath = `${sqliteDirectory}${IMPORT_STAGING_NAME}`;
const recoveryStagingPath = `${sqliteDirectory}${RECOVERY_STAGING_NAME}`;

export async function validateSqliteFile(uri: string) {
  console.info('[backup.validate][stage=read_header] reading backup header');
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 16,
    });
    const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    if (!hasSqliteHeader(bytes)) {
      throw new Error('Selected file is not a valid SQLite database');
    }
  } catch (error) {
    console.error('[backup.validate][stage=read_header] backup header validation failed', {
      error: String(error),
    });
    throw error;
  }
}

export async function createLocalBackup(now = new Date()) {
  let stage = 'locate_db';
  try {
    console.info('[backup.local][stage=locate_db] locating database', { database: DATABASE_NAME });
    const info = await FileSystem.getInfoAsync(databasePath);
    if (!info.exists) throw new Error('Database file not found');

    stage = 'create_directory';
    console.info('[backup.local][stage=create_directory] preparing backup directory');
    await FileSystem.makeDirectoryAsync(backupDirectory, { intermediates: true });
    const filename = backupFilename(now);
    const destination = `${backupDirectory}${filename}`;

    stage = 'copy_db';
    console.info('[backup.local][stage=copy_db] creating database snapshot');
    const destinationDb = SQLite.openDatabaseSync(filename, {}, backupDirectory);
    try {
      await SQLite.backupDatabaseAsync({ sourceDatabase: sqlite, destDatabase: destinationDb });
      stage = 'integrity_check';
      console.info('[backup.local][stage=integrity_check] checking database snapshot');
      const integrity = destinationDb.getFirstSync<{ integrity_check: string }>('PRAGMA integrity_check');
      if (integrity?.integrity_check !== 'ok') throw new Error('Backup integrity check failed');
    } finally {
      console.info('[backup.local][stage=close_snapshot] closing database snapshot');
      await destinationDb.closeAsync();
    }
    return destination;
  } catch (error) {
    console.error('[backup.local] backup creation failed', { stage, error: String(error) });
    throw error;
  }
}

function getDatabaseColumns(sourceDb: SQLite.SQLiteDatabase): Record<string, string[]> {
  const tableNames = sourceDb
    .getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .map(({ name }) => name);
  return Object.fromEntries(tableNames.map((table) => [
    table,
    sourceDb.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`).map(({ name }) => name),
  ]));
}

function getUserVersion(database: SQLite.SQLiteDatabase): number {
  return Number(database.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0);
}

function assertDatabaseIntegrity(database: SQLite.SQLiteDatabase): void {
  const integrity = database.getFirstSync<{ integrity_check: string }>('PRAGMA integrity_check');
  if (integrity?.integrity_check !== 'ok') throw new Error('Database integrity check failed');
}

function recognizeBackup(sourceDb: SQLite.SQLiteDatabase): BackupSchemaVersion {
  assertDatabaseIntegrity(sourceDb);
  const sourceVersion = detectBackupSchemaVersion(
    getDatabaseColumns(sourceDb),
    getUserVersion(sourceDb),
  );
  if (sourceVersion === null) throw new Error('Backup schema or integrity is invalid');
  return sourceVersion;
}

function assertLatestDatabase(database: SQLite.SQLiteDatabase): void {
  assertDatabaseIntegrity(database);
  if (detectBackupSchemaVersion(getDatabaseColumns(database), getUserVersion(database)) !== 3) {
    throw new Error('Restored database is not the exact latest schema');
  }
}

const copyDatabase = async (
  sourceDatabase: SQLite.SQLiteDatabase,
  destDatabase: SQLite.SQLiteDatabase,
) => {
  await SQLite.backupDatabaseAsync({ sourceDatabase, destDatabase });
};

async function withRecoveryDatabase<Result>(
  operation: (recovery: SQLite.SQLiteDatabase) => Promise<Result>,
): Promise<Result> {
  return withRecoverySnapshot({
    removeStaleRecovery: async () => {
      await FileSystem.deleteAsync(recoveryStagingPath, { idempotent: true });
    },
    openRecovery: () => SQLite.openDatabaseSync(RECOVERY_STAGING_NAME, {}, sqliteDirectory),
    closeRecovery: async (recovery) => {
      await recovery.closeAsync();
    },
    deleteRecovery: async () => {
      await FileSystem.deleteAsync(recoveryStagingPath, { idempotent: true });
    },
    operation,
  });
}

async function restoreSupportedBackup(
  sourceDb: SQLite.SQLiteDatabase,
  sourceVersion: BackupSchemaVersion,
) {
  console.info('[backup.restore][stage=sqlite_backup] restoring recognized database', {
    source_version: sourceVersion,
  });
  const result = await withRecoveryDatabase((recovery) => restoreRecognizedBackup({
    sourceVersion,
    source: sourceDb,
    destination: sqlite,
    recovery,
    copyDatabase,
    migrate: runSchemaMigrations,
    validateRecovery: assertDatabaseIntegrity,
    validateDestination: assertLatestDatabase,
  }));
  console.info('[backup.restore][stage=complete] database restore completed', {
    source_version: sourceVersion,
    mode: result.mode,
  });
  return result;
}

export async function restoreDatabase(sourceUri: string) {
  const stagingPath = `${sqliteDirectory}${RESTORE_STAGING_NAME}`;
  let sourceDb: SQLite.SQLiteDatabase | null = null;
  let stage = 'validate_file';
  try {
    await validateSqliteFile(sourceUri);
    stage = 'stage_file';
    console.info('[backup.restore][stage=stage_file] staging selected database');
    await FileSystem.deleteAsync(stagingPath, { idempotent: true });
    await FileSystem.copyAsync({ from: sourceUri, to: stagingPath });

    stage = 'validate_schema';
    console.info('[backup.restore][stage=validate_schema] validating staged database schema');
    sourceDb = SQLite.openDatabaseSync(RESTORE_STAGING_NAME, {}, sqliteDirectory);
    const sourceVersion = recognizeBackup(sourceDb);

    stage = sourceVersion === 2 ? 'restore_v2_and_migrate' : 'restore_v3';
    return await restoreSupportedBackup(sourceDb, sourceVersion);
  } catch (error) {
    console.error('[backup.restore] database restore failed', { stage, error: String(error) });
    throw error;
  } finally {
    if (sourceDb) {
      try {
        console.info('[backup.restore][stage=close_source] closing staged database');
        await sourceDb.closeAsync();
      } catch (cleanupError) {
        console.error('[backup.restore][stage=close_source] staged database close failed', {
          error: String(cleanupError),
        });
      }
    }
    try {
      console.info('[backup.restore][stage=cleanup] removing staged database');
      await FileSystem.deleteAsync(stagingPath, { idempotent: true });
    } catch (cleanupError) {
      console.error('[backup.restore][stage=cleanup] staged database cleanup failed', {
        error: String(cleanupError),
      });
    }
  }
}

function isLegacyDatabase(sourceDb: SQLite.SQLiteDatabase) {
  const tables = sourceDb
    .getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
    .map((row) => row.name);
  if (!tables.includes('transactions') || !tables.includes('recurring_transactions')) {
    return false;
  }

  const transactionColumns = sourceDb.getAllSync<{ name: string; type: string }>(
    'PRAGMA table_info(transactions)',
  );
  const idColumn = transactionColumns.find((column) => column.name === 'id');
  const hasNotesColumn = transactionColumns.some((column) => column.name === 'notes');

  return idColumn?.type.toUpperCase() === 'INTEGER' && !hasNotesColumn;
}

function clearCurrentDatabase() {
  console.info('[backup.import][stage=clear_current] clearing current database');
  sqlite.withTransactionSync(() => {
    sqlite.execSync(`
      DELETE FROM transactions;
      DELETE FROM transaction_templates;
      DELETE FROM categories;
      DELETE FROM settings;
    `);
  });
}

export async function importDatabase(sourceUri: string) {
  let sourceDb: SQLite.SQLiteDatabase | null = null;
  let stage = 'validate_file';
  try {
    await validateSqliteFile(sourceUri);
    stage = 'stage_file';
    console.info('[backup.import][stage=stage_file] staging selected database');
    await FileSystem.deleteAsync(importStagingPath, { idempotent: true });
    await FileSystem.copyAsync({ from: sourceUri, to: importStagingPath });

    stage = 'validate_schema';
    console.info('[backup.import][stage=validate_schema] validating staged database schema');
    sourceDb = SQLite.openDatabaseSync(IMPORT_STAGING_NAME, {}, sqliteDirectory);
    const integrity = sourceDb.getFirstSync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') {
      throw new Error('Backup schema or integrity is invalid');
    }

    const sourceVersion = detectBackupSchemaVersion(
      getDatabaseColumns(sourceDb),
      getUserVersion(sourceDb),
    );
    if (sourceVersion !== null) {
      stage = sourceVersion === 2 ? 'restore_v2_and_migrate' : 'restore_v3';
      return await restoreSupportedBackup(sourceDb, sourceVersion);
    }

    if (isLegacyDatabase(sourceDb)) {
      stage = 'stage_legacy';
      sourceDb.closeSync();
      sourceDb = null;

      const legacyPath = getLegacyDbPath();
      console.info('[backup.import][stage=stage_legacy] staging integer-ID legacy database');
      await FileSystem.deleteAsync(legacyPath, { idempotent: true });
      await FileSystem.copyAsync({ from: importStagingPath, to: legacyPath });

      stage = 'migrate_legacy';
      console.info('[backup.import][stage=migrate_legacy] migrating integer-ID legacy database');
      return await withRecoveryDatabase((recovery) => replaceDatabaseWithRecovery({
        destination: sqlite,
        recovery,
        copyDatabase,
        validateRecovery: assertDatabaseIntegrity,
        validateDestination: assertLatestDatabase,
        operation: async () => {
          clearCurrentDatabase();
          const result = await runMigration(db);
          if (!result.success) throw new Error(result.error || 'Legacy database migration failed');
          return { mode: 'migrate' as const, sourceVersion: 'legacy' as const, stats: result.stats };
        },
      }));
    }

    throw new Error('Backup schema or integrity is invalid');
  } catch (error) {
    console.error('[backup.import] database import failed', { stage, error: String(error) });
    throw error;
  } finally {
    if (sourceDb) {
      try {
        console.info('[backup.import][stage=close_source] closing staged database');
        sourceDb.closeSync();
      } catch (closeError) {
        console.error('[backup.import][stage=close_source] source database close failed', {
          error: String(closeError),
        });
      }
    }
    try {
      console.info('[backup.import][stage=cleanup] removing staged database');
      await FileSystem.deleteAsync(importStagingPath, { idempotent: true });
    } catch (cleanupError) {
      console.error('[backup.import][stage=cleanup] staging database cleanup failed', {
        error: String(cleanupError),
      });
    }
  }
}
