import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { sql } from "drizzle-orm";
import { v5 as uuidv5 } from 'uuid';
import { transactions, recurringTransactions, categories, settings } from './schema';

// Fixed namespace for deterministic UUID generation during migration
const MIGRATION_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * Generate deterministic UUID from legacy integer ID
 */
export const generateMigrationUUID = (legacyId: number): string => {
  return uuidv5(String(legacyId), MIGRATION_NAMESPACE);
};

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

  await newDb.insert(categories).values(values).run();
  console.info("[MIGRATION] Seeded preset categories:", values.length);
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
  await newDb
    .insert(settings)
    .values([
      { key: 'app.migrated', value: '1' },
      { key: 'app.migrated_at', value: String(now) },
    ])
    .run();
  console.info("[MIGRATION] Marked migration complete");
};

/**
 * Get legacy database path
 */
export const getLegacyDbPath = (): string => {
  // Legacy DB was at Documents/expense_tracker.db in the old app
  return SQLite.getDatabaseDirectory() + '/expense_tracker.db';
};

/**
 * Check if legacy database exists
 */
export const legacyDbExists = (): boolean => {
  try {
    const path = getLegacyDbPath();
    const legacyDb = SQLite.openDatabaseSync(path);
    const tables = legacyDb.getAllSync("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('transactions', 'recurring_transactions')");
    legacyDb.closeSync();
    return tables.length >= 2;
  } catch {
    return false;
  }
};

/**
 * Get legacy table row counts
 */
export const getLegacyCounts = async (): Promise<{ transactions: number; recurring: number } | null> => {
  try {
    const path = getLegacyDbPath();
    const legacyDb = SQLite.openDatabaseSync(path);
    const drizzleLegacy = drizzle(legacyDb);
    
    const txCount = await drizzleLegacy.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM transactions`
    );
    const recCount = await drizzleLegacy.get<{ count: number }>(
      sql`SELECT COUNT(*) as count FROM recurring_transactions`
    );
    
    legacyDb.closeSync();
    
    return {
      transactions: txCount?.count ?? 0,
      recurring: recCount?.count ?? 0,
    };
  } catch (error) {
    console.error("[MIGRATION] Failed to get legacy counts:", error);
    return null;
  }
};

/**
 * Migrate legacy transactions to new schema
 */
export const migrateTransactions = async (
  legacyDrizzle: ReturnType<typeof drizzle>,
  newDrizzle: ReturnType<typeof drizzle>
): Promise<number> => {
  const BATCH_SIZE = 1000;
  let totalMigrated = 0;
  
  const allLegacy = await legacyDrizzle.select().from(transactions).all();
  
  for (let i = 0; i < allLegacy.length; i += BATCH_SIZE) {
    const batch = allLegacy.slice(i, i + BATCH_SIZE);
    const values = batch.map((tx) => ({
      id: generateMigrationUUID(tx.id),
      amount: tx.amount,
      transactionDate: tx.transactionDate,
      description: tx.description,
      category: tx.category,
      recurringTransactionId: tx.recurringTransactionId ? generateMigrationUUID(tx.recurringTransactionId) : null,
      verified: tx.verified,
      notes: null,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    }));
    
    await newDrizzle.insert(transactions).values(values).run();
    totalMigrated += batch.length;
    console.info(`[MIGRATION] Migrated batch ${i / BATCH_SIZE + 1}: ${batch.length} transactions`);
  }
  
  return totalMigrated;
};

/**
 * Migrate legacy recurring transactions to new schema
 */
export const migrateRecurringTransactions = async (
  legacyDrizzle: ReturnType<typeof drizzle>,
  newDrizzle: ReturnType<typeof drizzle>
): Promise<number> => {
  const BATCH_SIZE = 1000;
  let totalMigrated = 0;
  
  const allLegacy = await legacyDrizzle.select().from(recurringTransactions).all();
  
  for (let i = 0; i < allLegacy.length; i += BATCH_SIZE) {
    const batch = allLegacy.slice(i, i + BATCH_SIZE);
    const values = batch.map((rt) => ({
      id: generateMigrationUUID(rt.id),
      amount: rt.amount,
      description: rt.description,
      category: rt.category,
      startDate: rt.startDate,
      lastCharged: rt.lastCharged,
      recurrenceValue: rt.recurrenceValue,
      createdAt: rt.createdAt,
      updatedAt: rt.updatedAt,
    }));
    
    await newDrizzle.insert(recurringTransactions).values(values).run();
    totalMigrated += batch.length;
    console.info(`[MIGRATION] Migrated batch ${i / BATCH_SIZE + 1}: ${batch.length} recurring transactions`);
  }
  
  return totalMigrated;
};

/**
 * Backup legacy database after successful migration
 */
export const backupLegacyDb = async (): Promise<string | null> => {
  try {
    const legacyPath = getLegacyDbPath();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = SQLite.getDatabaseDirectory() + `/legacy_backup_${timestamp}.db`;
    
    // Copy file using FileSystem
    const { copyFile } = await import('expo-file-system');
    await copyFile({
      from: legacyPath,
      to: backupPath,
    });
    
    console.info("[MIGRATION] Legacy DB backed up to:", backupPath);
    return backupPath;
  } catch (error) {
    console.error("[MIGRATION] Failed to backup legacy DB:", error);
    return null;
  }
};

/**
 * Run full migration from legacy to new schema
 */
export const runMigration = async (newDb: ReturnType<typeof drizzle>): Promise<{ success: boolean; error?: string; stats?: any }> => {
  try {
    console.info("[MIGRATION] Starting migration...");
    
    // Open legacy DB
    const legacyPath = getLegacyDbPath();
    const legacyDb = SQLite.openDatabaseSync(legacyPath);
    const legacyDrizzle = drizzle(legacyDb);
    
    // Get counts for reporting
    const counts = await getLegacyCounts();
    if (!counts) {
      return { success: false, error: 'Could not read legacy database' };
    }
    
    // Check if already migrated
    const alreadyDone = await isMigrationDone(newDb);
    if (alreadyDone) {
      legacyDb.closeSync();
      return { success: false, error: 'Migration already completed' };
    }
    
    // Seed preset categories first
    await seedPresetCategories(newDb);
    
    // Migrate transactions
    const txMigrated = await migrateTransactions(legacyDrizzle, newDb);
    console.info("[MIGRATION] Total transactions migrated:", txMigrated);
    
    // Migrate recurring transactions
    const recMigrated = await migrateRecurringTransactions(legacyDrizzle, newDb);
    console.info("[MIGRATION] Total recurring transactions migrated:", recMigrated);
    
    // Mark migration complete
    await markMigrationComplete(newDb);
    
    // Backup legacy DB
    const backupPath = await backupLegacyDb();
    
    legacyDb.closeSync();
    
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
    console.error("[MIGRATION] Migration failed:", error);
    return { success: false, error: String(error) };
  }
};
