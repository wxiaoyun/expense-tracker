import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { DATABASE_NAME } from '@/db/schema-sql';
import { db, sqlite } from '@/db';
import { getLegacyDbPath, runMigration } from '@/db/migration';
import { backupFilename, hasExactColumns, hasSqliteHeader } from './backup-core';

export const databasePath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
export const backupDirectory = `${FileSystem.documentDirectory}Backups/`;
const REQUIRED_COLUMNS: Record<string, string[]> = {
  transactions: ['id', 'amount', 'transaction_date', 'description', 'category', 'recurring_transaction_id', 'verified', 'notes', 'created_at', 'updated_at'],
  recurring_transactions: ['id', 'amount', 'description', 'category', 'start_date', 'last_charged', 'recurrence_value', 'created_at', 'updated_at'],
  categories: ['id', 'name', 'icon', 'color', 'is_preset', 'sort_order', 'created_at'],
  settings: ['key', 'value'],
};
const IMPORT_STAGING_NAME = 'expense_tracker_import_candidate.db';
const sqliteDirectory = `${FileSystem.documentDirectory}SQLite/`;
const importStagingPath = `${sqliteDirectory}${IMPORT_STAGING_NAME}`;

export async function validateSqliteFile(uri: string) {
  console.info('[backup.validate][stage=read_header] reading backup header', { uri });
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64, length: 16 });
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  if (!hasSqliteHeader(bytes)) {
    console.error('[backup.validate][stage=read_header] invalid SQLite header', { uri });
    throw new Error('Selected file is not a valid SQLite database');
  }
}

export async function createLocalBackup(now = new Date()) {
  console.info('[backup.local][stage=locate_db] locating database', { database: DATABASE_NAME });
  const info = await FileSystem.getInfoAsync(databasePath);
  if (!info.exists) {
    console.error('[backup.local][stage=locate_db] database missing', { database: DATABASE_NAME });
    throw new Error('Database file not found');
  }
  await FileSystem.makeDirectoryAsync(backupDirectory, { intermediates: true });
  const filename = backupFilename(now);
  const destination = `${backupDirectory}${filename}`;
  console.info('[backup.local][stage=copy_db] creating backup', { destination });
  const destinationDb = SQLite.openDatabaseSync(filename, {}, backupDirectory);
  try {
    await SQLite.backupDatabaseAsync({ sourceDatabase: sqlite, destDatabase: destinationDb });
    const integrity = destinationDb.getFirstSync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') throw new Error('Backup integrity check failed');
  } finally {
    await destinationDb.closeAsync();
  }
  return destination;
}

export async function restoreDatabase(sourceUri: string) {
  await validateSqliteFile(sourceUri);
  const stagingName = 'expense_tracker_restore_candidate.db';
  const sqliteDirectory = `${FileSystem.documentDirectory}SQLite/`;
  const stagingPath = `${sqliteDirectory}${stagingName}`;
  await FileSystem.deleteAsync(stagingPath, { idempotent: true });
  await FileSystem.copyAsync({ from: sourceUri, to: stagingPath });
  const sourceDb = SQLite.openDatabaseSync(stagingName, {}, sqliteDirectory);
  try {
    const integrity = sourceDb.getFirstSync<{ integrity_check: string }>('PRAGMA integrity_check');
    const schemaValid = Object.entries(REQUIRED_COLUMNS).every(([table, expected]) => {
      const columns = sourceDb.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`).map(column => column.name);
      return hasExactColumns(columns, expected);
    });
    if (integrity?.integrity_check !== 'ok' || !schemaValid) {
      console.error('[backup.restore][stage=validate_schema] backup validation failed', { integrity: integrity?.integrity_check, schema_valid: schemaValid });
      throw new Error('Backup schema or integrity is invalid');
    }
    console.info('[backup.restore][stage=sqlite_backup] restoring validated database');
    await SQLite.backupDatabaseAsync({ sourceDatabase: sourceDb, destDatabase: sqlite });
  } finally {
    await sourceDb.closeAsync();
    await FileSystem.deleteAsync(stagingPath, { idempotent: true });
  }
}

function getColumnNames(sourceDb: SQLite.SQLiteDatabase, table: string) {
  return sourceDb
    .getAllSync<{ name: string }>(`PRAGMA table_info(${table})`)
    .map((column) => column.name);
}

function isV2Database(sourceDb: SQLite.SQLiteDatabase) {
  return Object.entries(REQUIRED_COLUMNS).every(([table, expected]) =>
    hasExactColumns(getColumnNames(sourceDb, table), expected),
  );
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
  sqlite.execSync(`
    DELETE FROM transactions;
    DELETE FROM recurring_transactions;
    DELETE FROM categories;
    DELETE FROM settings;
  `);
}

export async function importDatabase(sourceUri: string) {
  await validateSqliteFile(sourceUri);
  await FileSystem.deleteAsync(importStagingPath, { idempotent: true });
  await FileSystem.copyAsync({ from: sourceUri, to: importStagingPath });

  let sourceDb: SQLite.SQLiteDatabase | null = null;
  try {
    sourceDb = SQLite.openDatabaseSync(IMPORT_STAGING_NAME, {}, sqliteDirectory);
    const integrity = sourceDb.getFirstSync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') {
      console.error('[backup.import][stage=validate_schema] imported database integrity failed', {
        integrity: integrity?.integrity_check,
      });
      throw new Error('Backup schema or integrity is invalid');
    }

    if (isV2Database(sourceDb)) {
      console.info('[backup.import][stage=restore_v2] restoring current-schema database');
      await SQLite.backupDatabaseAsync({ sourceDatabase: sourceDb, destDatabase: sqlite });
      return { mode: 'restore' as const };
    }

    if (isLegacyDatabase(sourceDb)) {
      sourceDb.closeSync();
      sourceDb = null;

      const legacyPath = getLegacyDbPath();
      await FileSystem.deleteAsync(legacyPath, { idempotent: true });
      await FileSystem.copyAsync({ from: importStagingPath, to: legacyPath });
      console.info('[backup.import][stage=migrate_legacy] staging legacy database', { legacyPath });

      clearCurrentDatabase();
      const result = await runMigration(db);
      if (!result.success) {
        throw new Error(result.error || 'Legacy database migration failed');
      }

      return { mode: 'migrate' as const, stats: result.stats };
    }

    console.error('[backup.import][stage=validate_schema] imported database has unsupported schema');
    throw new Error('Backup schema or integrity is invalid');
  } finally {
    if (sourceDb) {
      try {
        sourceDb.closeSync();
      } catch (closeError) {
        console.warn('[backup.import][stage=close_source] source database close failed', {
          error: String(closeError),
        });
      }
    }
    await FileSystem.deleteAsync(importStagingPath, { idempotent: true });
  }
}
