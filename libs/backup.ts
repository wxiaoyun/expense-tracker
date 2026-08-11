import * as FileSystem from 'expo-file-system/legacy';
import * as SQLite from 'expo-sqlite';
import { DATABASE_NAME } from '@/db/schema-sql';
import { sqlite } from '@/db';
import { backupFilename, hasExactColumns, hasSqliteHeader } from './backup-core';

export const databasePath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
export const backupDirectory = `${FileSystem.documentDirectory}Backups/`;
const REQUIRED_COLUMNS: Record<string, string[]> = {
  transactions: ['id', 'amount', 'transaction_date', 'description', 'category', 'recurring_transaction_id', 'verified', 'notes', 'created_at', 'updated_at'],
  recurring_transactions: ['id', 'amount', 'description', 'category', 'start_date', 'last_charged', 'recurrence_value', 'created_at', 'updated_at'],
  categories: ['id', 'name', 'icon', 'color', 'is_preset', 'sort_order', 'created_at'],
  settings: ['key', 'value'],
};

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
