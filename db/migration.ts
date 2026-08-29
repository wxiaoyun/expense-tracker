import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { eq, sql } from "drizzle-orm";
import { transactions, transactionTemplates, categories, settings } from './schema';
import { LEGACY_DATABASE_NAME } from './schema-sql';
import {
  generateMigrationUUID,
  mapLegacyRecurring,
  mapLegacyTransaction,
  type LegacyRecurring,
  type LegacyTransaction,
} from './migration-core';
import { backupLegacyDatabase } from './migration-backup';

export { generateMigrationUUID } from './migration-core';

/**
 * Preset categories to seed on first launch
 */
const PRESET_CATEGORIES = [
  { name: 'Food', icon: 'fork.knife', color: '#FF9500', sortOrder: 0 },
  { name: 'Transport', icon: 'bus', color: '#007AFF', sortOrder: 1 },
  { name: 'Shopping', icon: 'bag', color: '#AF52DE', sortOrder: 2 },
  { name: 'Entertainment', icon: 'gamecontroller', color: '#FF2D55', sortOrder: 3 },
  { name: 'Bills', icon: 'doc.text', color: '#34C759', sortOrder: 4 },
  { name: 'Healthcare', icon: 'cross.case', color: '#FF3B30', sortOrder: 5 },
  { name: 'Education', icon: 'book', color: '#5856D6', sortOrder: 6 },
  { name: 'Other', icon: 'ellipsis.circle', color: '#8E8E93', sortOrder: 7 },
];

/**
 * Seed preset categories into the new database
 */
export const seedPresetCategories = async (newDb: ReturnType<typeof drizzle>): Promise<void> => {
  const now = Date.now();
  const values = PRESET_CATEGORIES.map((cat, index) => ({
    id: generateMigrationUUID(index + 1),
    name: cat.name,
    icon: cat.icon,
    color: cat.color,
    is_preset: true,
    sort_order: cat.sortOrder,
    createdAt: now,
  }));

  console.info('[migration][stage=seed_categories] inserting preset categories', { count: values.length });
  await newDb.insert(categories).values(values).onConflictDoNothing().run();
  console.info('[migration][stage=seed_categories] preset categories ready', { count: values.length });
};

/**
 * Check if migration has already been performed
 */
export const isMigrationDone = async (newDb: ReturnType<typeof drizzle>): Promise<boolean> => {
  const result = await newDb
    .select({ value: settings.value })
    .from(settings)
    .where(sql`${settings.key} = 'app.migrated'`)
    .get();
  
  return result?.value === '1';
};

/**
 * Mark migration as complete
 */
export const markMigrationComplete = async (newDb: ReturnType<typeof drizzle>): Promise<void> => {
  const now = Date.now();
  console.info('[migration][stage=mark_complete] persisting migration marker');
  await newDb.insert(settings).values({ key: 'app.migrated', value: '1' })
    .onConflictDoUpdate({ target: settings.key, set: { value: '1' } }).run();
  await newDb.insert(settings).values({ key: 'app.migrated_at', value: String(now) })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(now) } }).run();
  console.info('[migration][stage=mark_complete] migration marker persisted');
};

/**
 * Get legacy database path
 */
export const getLegacyDbPath = (): string => {
  return `${SQLite.defaultDatabaseDirectory}/${LEGACY_DATABASE_NAME}`;
};

const openLegacyDatabase = (): SQLite.SQLiteDatabase => {
  console.info('[migration][stage=open_legacy] opening legacy database', {
    database: LEGACY_DATABASE_NAME,
  });
  return SQLite.openDatabaseSync(
    LEGACY_DATABASE_NAME,
    { enableChangeListener: false },
    SQLite.defaultDatabaseDirectory,
  );
};

/**
 * Check if legacy database exists
 */
export const legacyDbExists = (): boolean => {
  try {
    const legacyDb = openLegacyDatabase();
    const tables = legacyDb.getAllSync("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('transactions', 'recurring_transactions')");
    const transactionColumns = legacyDb.getAllSync<{ name: string; type: string }>('PRAGMA table_info(transactions)');
    const idColumn = transactionColumns.find((column) => column.name === 'id');
    legacyDb.closeSync();
    return tables.length === 2 && idColumn?.type.toUpperCase() === 'INTEGER';
  } catch (error) {
    console.info('[migration][stage=detect_legacy][reason=not_found] legacy database unavailable', {
      error: String(error),
    });
    return false;
  }
};

/**
 * Get legacy table row counts
 */
export const getLegacyCounts = async (): Promise<{
  transactions: number;
  recurring: number;
  linkedTransactions: number;
  relationships: number;
} | null> => {
  try {
    const legacyDb = openLegacyDatabase();
    const txCount = legacyDb.getFirstSync<{ count: number }>("SELECT COUNT(*) as count FROM transactions");
    const recCount = legacyDb.getFirstSync<{ count: number }>("SELECT COUNT(*) as count FROM recurring_transactions");
    const linkedCount = legacyDb.getFirstSync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM transactions WHERE recurring_transaction_id IS NOT NULL',
    );
    const relationshipCount = legacyDb.getFirstSync<{ count: number }>(`
      SELECT COUNT(*) AS count
      FROM transactions
      JOIN recurring_transactions
        ON transactions.recurring_transaction_id = recurring_transactions.id
    `);
    legacyDb.closeSync();
    return {
      transactions: txCount?.count ?? 0,
      recurring: recCount?.count ?? 0,
      linkedTransactions: linkedCount?.count ?? 0,
      relationships: relationshipCount?.count ?? 0,
    };
  } catch (error) {
    console.error('[migration][stage=count_legacy] failed to count legacy rows', { error: String(error) });
    return null;
  }
};

/**
 * Migrate legacy transactions to new schema
 */
export const migrateTransactions = async (
  legacyDb: SQLite.SQLiteDatabase,
  newDrizzle: ReturnType<typeof drizzle>
): Promise<number> => {
  const BATCH_SIZE = 1000;
  let totalMigrated = 0;
  
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const batch = legacyDb.getAllSync<LegacyTransaction>(
      'SELECT * FROM transactions ORDER BY id LIMIT ? OFFSET ?',
      BATCH_SIZE,
      offset,
    );
    if (batch.length === 0) break;
    const values = batch.map(mapLegacyTransaction);

    console.info('[migration][stage=copy_transactions] inserting batch', {
      batch: offset / BATCH_SIZE + 1,
      count: batch.length,
      offset,
    });
    await newDrizzle.insert(transactions).values(values).onConflictDoNothing().run();
    totalMigrated += batch.length;
  }
  
  return totalMigrated;
};

/**
 * Migrate legacy recurring transactions to new schema
 */
export const migrateRecurringTransactions = async (
  legacyDb: SQLite.SQLiteDatabase,
  newDrizzle: ReturnType<typeof drizzle>
): Promise<number> => {
  const BATCH_SIZE = 1000;
  const activeNames = new Set<string>();
  let totalMigrated = 0;

  for (let offset = 0; ; offset += BATCH_SIZE) {
    const batch = legacyDb.getAllSync<LegacyRecurring>(
      'SELECT * FROM recurring_transactions ORDER BY created_at, id LIMIT ? OFFSET ?',
      BATCH_SIZE,
      offset,
    );
    if (batch.length === 0) break;
    const values = batch.map((row) => mapLegacyRecurring(row, activeNames));

    console.info('[migration][stage=copy_templates] inserting batch', {
      batch: offset / BATCH_SIZE + 1,
      count: batch.length,
      offset,
    });
    await newDrizzle.insert(transactionTemplates).values(values).onConflictDoNothing().run();
    totalMigrated += batch.length;
  }

  return totalMigrated;
};

/**
 * Backup legacy database after successful migration
 */
export const backupLegacyDb = async (legacyDb: SQLite.SQLiteDatabase): Promise<string | null> => {
  try {
    const backupPath = await backupLegacyDatabase(async ({ to }) => {
      const filename = to.split('/').pop();
      if (!filename) throw new Error('Invalid legacy backup destination');
      const destinationDb = SQLite.openDatabaseSync(filename, {}, SQLite.defaultDatabaseDirectory);
      try {
        await SQLite.backupDatabaseAsync({ sourceDatabase: legacyDb, destDatabase: destinationDb });
        const integrity = destinationDb.getFirstSync<{ integrity_check: string }>('PRAGMA integrity_check');
        if (integrity?.integrity_check !== 'ok') throw new Error('Legacy backup integrity check failed');
      } finally {
        await destinationDb.closeAsync();
      }
    }, getLegacyDbPath(), SQLite.defaultDatabaseDirectory);
    console.info('[migration][stage=backup_legacy] legacy database backed up', { backupPath });
    return backupPath;
  } catch (error) {
    console.error('[migration][stage=backup_legacy] legacy database backup failed', { error: String(error) });
    return null;
  }
};

/**
 * Run full migration from legacy to new schema
 */
export const runMigration = async (newDb: ReturnType<typeof drizzle>): Promise<{ success: boolean; error?: string; stats?: any }> => {
  let legacyDb: SQLite.SQLiteDatabase | null = null;
  try {
    console.info('[migration][stage=start] starting migration');

    legacyDb = openLegacyDatabase();
    
    const counts = await getLegacyCounts();
    if (!counts) {
      return { success: false, error: 'Could not read legacy database' };
    }
    
    const alreadyDone = await isMigrationDone(newDb);
    if (alreadyDone) {
      return { success: false, error: 'Migration already completed' };
    }
    
    await seedPresetCategories(newDb);
    
    const txMigrated = await migrateTransactions(legacyDb, newDb);
    console.info('[migration][stage=copy_transactions] transaction copy finished', { count: txMigrated });
    
    const recMigrated = await migrateRecurringTransactions(legacyDb, newDb);
    console.info('[migration][stage=copy_templates] template copy finished', { count: recMigrated });

    const newTransactionCount = await newDb.select({ count: sql<number>`count(*)` }).from(transactions).get();
    const newTemplateCount = await newDb.select({ count: sql<number>`count(*)` }).from(transactionTemplates).get();
    const newLinkedCount = await newDb
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(sql`${transactions.templateId} IS NOT NULL`)
      .get();
    const newRelationshipCount = await newDb
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .innerJoin(transactionTemplates, eq(transactions.templateId, transactionTemplates.id))
      .get();
    if (Number(newTransactionCount?.count ?? 0) !== counts.transactions ||
        Number(newTemplateCount?.count ?? 0) !== counts.recurring ||
        Number(newLinkedCount?.count ?? 0) !== counts.linkedTransactions ||
        Number(newRelationshipCount?.count ?? 0) !== counts.relationships) {
      console.error('[migration][stage=verify_counts] migrated counts or relationships do not match source', {
        expectedTransactions: counts.transactions,
        actualTransactions: Number(newTransactionCount?.count ?? 0),
        expectedTemplates: counts.recurring,
        actualTemplates: Number(newTemplateCount?.count ?? 0),
        expectedLinkedTransactions: counts.linkedTransactions,
        actualLinkedTransactions: Number(newLinkedCount?.count ?? 0),
        expectedRelationships: counts.relationships,
        actualRelationships: Number(newRelationshipCount?.count ?? 0),
      });
      return { success: false, error: 'Migrated row counts or relationships do not match source database' };
    }
    console.info('[migration][stage=verify_counts] migrated counts and relationships match source', counts);
    
    const backupPath = await backupLegacyDb(legacyDb);
    if (!backupPath) {
      return { success: false, error: 'Legacy database backup failed. Migration remains retryable.' };
    }

    await markMigrationComplete(newDb);
    
    return {
      success: true,
      stats: {
        transactionsMigrated: txMigrated,
        recurringMigrated: recMigrated,
        backupPath,
        expectedTransactions: counts.transactions,
        expectedRecurring: counts.recurring,
      },
    };
  } catch (error) {
    console.error('[migration][stage=run] migration failed', { error: String(error) });
    return { success: false, error: String(error) };
  } finally {
    if (legacyDb) {
      try {
        legacyDb.closeSync();
      } catch (closeError) {
        console.error('[migration][stage=close_legacy] legacy database close failed', { error: String(closeError) });
      }
    }
  }
};
