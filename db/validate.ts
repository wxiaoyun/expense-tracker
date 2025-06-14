import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";

/**
 * Expected database schema structure
 */
const EXPECTED_TABLES = {
  transactions: {
    columns: [
      'id',
      'amount', 
      'transaction_date',
      'description',
      'category',
      'recurring_transaction_id',
      'verified',
      'created_at',
      'updated_at'
    ],
    indexes: [
      'idx_transactions_date',
      'idx_transactions_category', 
      'idx_transactions_recurring',
      'idx_transactions_verified'
    ]
  },
  recurring_transactions: {
    columns: [
      'id',
      'amount',
      'description', 
      'category',
      'start_date',
      'last_charged',
      'recurrence_value',
      'created_at',
      'updated_at'
    ],
    indexes: [
      'idx_recurring_transactions_date',
      'idx_recurring_transactions_category',
      'idx_recurring_transactions_last_charged'
    ]
  }
} as const;

/**
 * Validate database structure and basic integrity
 */
export const validateDatabase = async (databasePath: string): Promise<boolean> => {
  let db: SQLite.SQLiteDatabase | null = null;
  
  try {
    console.info("[DB][validateDatabase] Starting validation for:", databasePath);
    
    // Open the database for validation
    db = SQLite.openDatabaseSync(databasePath);
    const drizzleDb = drizzle(db);
    
    // Check if database is accessible
    const versionResult = await drizzleDb.get<{ version: string }>(
      sql`SELECT sqlite_version() as version`
    );
    
    if (!versionResult) {
      console.error("[DB][validateDatabase] Cannot access database");
      return false;
    }
    
    console.info("[DB][validateDatabase] SQLite version:", versionResult.version);
    
    // Validate table structure
    for (const [tableName, expectedStructure] of Object.entries(EXPECTED_TABLES)) {
      const isValid = await validateTable(drizzleDb, tableName, expectedStructure);
      if (!isValid) {
        console.error(`[DB][validateDatabase] Table validation failed: ${tableName}`);
        return false;
      }
    }
    
    // Perform basic data integrity checks
    const integrityCheck = await performIntegrityChecks(drizzleDb);
    if (!integrityCheck) {
      console.error("[DB][validateDatabase] Data integrity check failed");
      return false;
    }
    
    console.info("[DB][validateDatabase] Database validation successful");
    return true;
    
  } catch (error) {
    console.error("[DB][validateDatabase] Validation error:", error);
    return false;
  } finally {
    // Close the validation database connection
    if (db) {
      try {
        db.closeSync();
        console.info("[DB][validateDatabase] Validation database connection closed");
      } catch (closeError) {
        console.warn("[DB][validateDatabase] Error closing validation database:", closeError);
      }
    }
  }
};

/**
 * Validate individual table structure
 */
const validateTable = async (
  db: ReturnType<typeof drizzle>,
  tableName: string,
  expectedStructure: { columns: readonly string[]; indexes: readonly string[] }
): Promise<boolean> => {
  try {
    // Check if table exists
    const tableInfo = await db.get(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name=${tableName}`
    );
    
    if (!tableInfo) {
      console.error(`[DB][validateTable] Table '${tableName}' does not exist`);
      return false;
    }
    
    // Get table schema - using raw SQL since PRAGMA doesn't work well with parameterized queries
    const columns = await db.all(
      sql.raw(`PRAGMA table_info(${tableName})`)
    );
    
    const columnNames = columns.map((col: any) => col.name);
    
    // Check if all expected columns exist
    for (const expectedColumn of expectedStructure.columns) {
      if (!columnNames.includes(expectedColumn)) {
        console.error(`[DB][validateTable] Missing column '${expectedColumn}' in table '${tableName}'`);
        return false;
      }
    }
    
    // Check indexes
    const indexes = await db.all(
      sql`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name=${tableName}`
    );
    
    const indexNames = indexes.map((idx: any) => idx.name).filter((name: string) => 
      // Filter out auto-generated indexes (they start with sqlite_autoindex_)
      !name.startsWith('sqlite_autoindex_')
    );
    
    // Check if expected indexes exist
    for (const expectedIndex of expectedStructure.indexes) {
      if (!indexNames.includes(expectedIndex)) {
        console.warn(`[DB][validateTable] Missing index '${expectedIndex}' in table '${tableName}' (non-critical)`);
        // Indexes are non-critical for basic functionality, so we don't fail validation
      }
    }
    
    console.info(`[DB][validateTable] Table '${tableName}' validation passed`);
    return true;
    
  } catch (error) {
    console.error(`[DB][validateTable] Error validating table '${tableName}':`, error);
    return false;
  }
};

/**
 * Perform basic data integrity checks
 */
const performIntegrityChecks = async (db: ReturnType<typeof drizzle>): Promise<boolean> => {
  try {
    // Check database integrity
    const integrityResult = await db.get<{ integrity_check: string }>(sql`PRAGMA integrity_check`);
    
    if (integrityResult && integrityResult.integrity_check !== 'ok') {
      console.error("[DB][performIntegrityChecks] Database integrity check failed:", integrityResult);
      return false;
    }
    
    // Check foreign key constraints (if any)
    const foreignKeyResult = await db.get<any>(sql`PRAGMA foreign_key_check`);
    
    if (foreignKeyResult) {
      console.error("[DB][performIntegrityChecks] Foreign key constraint violations found:", foreignKeyResult);
      return false;
    }
    
    // Basic data validation - check for reasonable data types
    try {
      // Check transactions table has valid data types
      const transactionSample = await db.get<{
        id: number;
        amount: number;
        transaction_date: number;
        category: string;
        verified: number;
        created_at: number;
        updated_at: number;
      }>(
        sql`SELECT id, amount, transaction_date, category, verified, created_at, updated_at 
           FROM transactions LIMIT 1`
      );
      
      if (transactionSample) {
        // Validate basic data types
        if (typeof transactionSample.id !== 'number' ||
            typeof transactionSample.amount !== 'number' ||
            typeof transactionSample.transaction_date !== 'number' ||
            typeof transactionSample.category !== 'string' ||
            typeof transactionSample.verified !== 'number' ||
            typeof transactionSample.created_at !== 'number' ||
            typeof transactionSample.updated_at !== 'number') {
          console.error("[DB][performIntegrityChecks] Invalid data types in transactions table");
          return false;
        }
      }
      
      // Check recurring_transactions table has valid data types
      const recurringTransactionSample = await db.get<{
        id: number;
        amount: number;
        category: string;
        start_date: number;
        recurrence_value: string;
        created_at: number;
        updated_at: number;
      }>(
        sql`SELECT id, amount, category, start_date, recurrence_value, created_at, updated_at 
           FROM recurring_transactions LIMIT 1`
      );
      
      if (recurringTransactionSample) {
        if (typeof recurringTransactionSample.id !== 'number' ||
            typeof recurringTransactionSample.amount !== 'number' ||
            typeof recurringTransactionSample.category !== 'string' ||
            typeof recurringTransactionSample.start_date !== 'number' ||
            typeof recurringTransactionSample.recurrence_value !== 'string' ||
            typeof recurringTransactionSample.created_at !== 'number' ||
            typeof recurringTransactionSample.updated_at !== 'number') {
          console.error("[DB][performIntegrityChecks] Invalid data types in recurring_transactions table");
          return false;
        }
      }
      
    } catch (dataCheckError) {
      // If tables are empty, that's fine - just log it
      console.info("[DB][performIntegrityChecks] Tables appear to be empty, skipping data type validation");
    }
    
    console.info("[DB][performIntegrityChecks] Data integrity checks passed");
    return true;
    
  } catch (error) {
    console.error("[DB][performIntegrityChecks] Error during integrity checks:", error);
    return false;
  }
};

/**
 * Quick validation check - just verify the database can be opened and has the basic tables
 */
export const quickValidateDatabase = async (databasePath: string): Promise<boolean> => {
  let db: SQLite.SQLiteDatabase | null = null;
  
  try {
    db = SQLite.openDatabaseSync(databasePath);
    const drizzleDb = drizzle(db);
    
    // Just check if the main tables exist
    const transactionsTable = await drizzleDb.get(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'`
    );
    
    const recurringTransactionsTable = await drizzleDb.get(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='recurring_transactions'`
    );
    
    return !!(transactionsTable && recurringTransactionsTable);
    
  } catch (error) {
    console.error("[DB][quickValidateDatabase] Quick validation error:", error);
    return false;
  } finally {
    if (db) {
      try {
        db.closeSync();
      } catch (closeError) {
        console.warn("[DB][quickValidateDatabase] Error closing database:", closeError);
      }
    }
  }
};
