import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as SQLite from "expo-sqlite";

/**
 * Expected database schema structure for the new app
 */
const EXPECTED_TABLES = {
  categories: {
    columns: [
      'id',
      'name', 
      'icon',
      'color',
      'is_preset',
      'sort_order',
      'created_at'
    ],
    indexes: [
      'idx_categories_name'
    ]
  },
  transactions: {
    columns: [
      'id',
      'amount', 
      'transaction_date',
      'description',
      'category',
      'recurring_transaction_id',
      'verified',
      'notes',
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
  },
  settings: {
    columns: [
      'key',
      'value'
    ],
    indexes: [] // primary key is implicit
  }
} as const;

/**
 * Validate database structure and basic integrity
 */
export const validateDatabase = async (databaseName: string): Promise<boolean> => {
  let db: SQLite.SQLiteDatabase | null = null;
  
  try {
    console.info("[DB][validateDatabase] Starting validation for:", databaseName);
    
    // Open the database for validation
    db = SQLite.openDatabaseSync(databaseName);
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
      // Check categories table has valid data types
      const categorySample = await db.get<{
        id: string;
        name: string;
        icon: string;
        color: string;
        is_preset: number;
        sort_order: number;
        created_at: number;
      }>(
        sql`SELECT id, name, icon, color, is_preset, sort_order, created_at 
           FROM categories LIMIT 1`
      );
      
      if (categorySample) {
        // Validate basic data types
        if (typeof categorySample.id !== 'string' ||
            typeof categorySample.name !== 'string' ||
            typeof categorySample.icon !== 'string' ||
            typeof categorySample.color !== 'string' ||
            typeof categorySample.is_preset !== 'number' ||
            typeof categorySample.sort_order !== 'number' ||
            typeof categorySample.created_at !== 'number') {
          console.error("[DB][performIntegrityChecks] Invalid data types in categories table");
          return false;
        }
      }
      
      // Check transactions table has valid data types
      const transactionSample = await db.get<{
        id: string;
        amount: number;
        transaction_date: number;
        description: string;
        category: string;
        verified: number;
        notes: string | null;
        created_at: number;
        updated_at: number;
      }>(
        sql`SELECT id, amount, transaction_date, description, category, verified, notes, created_at, updated_at 
           FROM transactions LIMIT 1`
      );
      
      if (transactionSample) {
        // Validate basic data types
        if (typeof transactionSample.id !== 'string' ||
            typeof transactionSample.amount !== 'number' ||
            typeof transactionSample.transaction_date !== 'number' ||
            typeof transactionSample.description !== 'string' ||
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
        id: string;
        amount: number;
        description: string;
        category: string;
        start_date: number;
        last_charged: number | null;
        recurrence_value: string;
        created_at: number;
        updated_at: number;
      }>(
        sql`SELECT id, amount, description, category, start_date, last_charged, recurrence_value, created_at, updated_at 
           FROM recurring_transactions LIMIT 1`
      );
      
      if (recurringTransactionSample) {
        if (typeof recurringTransactionSample.id !== 'string' ||
            typeof recurringTransactionSample.amount !== 'number' ||
            typeof recurringTransactionSample.description !== 'string' ||
            typeof recurringTransactionSample.category !== 'string' ||
            typeof recurringTransactionSample.start_date !== 'number' ||
            typeof recurringTransactionSample.last_charged !== 'number' ||
            typeof recurringTransactionSample.recurrence_value !== 'string' ||
            typeof recurringTransactionSample.created_at !== 'number' ||
            typeof recurringTransactionSample.updated_at !== 'number') {
          console.error("[DB][performIntegrityChecks] Invalid data types in recurring_transactions table");
          return false;
        }
      }
      
      // Check settings table has valid data types
      const settingsSample = await db.get<{
        key: string;
        value: string;
      }>(
        sql`SELECT key, value FROM settings LIMIT 1`
      );
      
      if (settingsSample) {
        if (typeof settingsSample.key !== 'string' ||
            typeof settingsSample.value !== 'string') {
          console.error("[DB][performIntegrityChecks] Invalid data types in settings table");
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
    console.info("[DB][quickValidateDatabase] Opening database:", databasePath);
    
    // Try different approaches to open the database
    try {
      db = SQLite.openDatabaseSync(databasePath);
    } catch (openError) {
      console.error("[DB][quickValidateDatabase] Failed to open with openDatabaseSync:", openError);
      
      // Try alternative opening method
      try {
        db = SQLite.openDatabaseSync(databasePath, { enableChangeListener: false });
      } catch (altOpenError) {
        console.error("[DB][quickValidateDatabase] Failed to open with alternative method:", altOpenError);
        return false;
      }
    }
    
    const drizzleDb = drizzle(db);
    
    // Test basic database connectivity
    try {
      const testQuery = await drizzleDb.get(sql`SELECT 1 as test`);
      console.info("[DB][quickValidateDatabase] Basic connectivity test:", testQuery);
    } catch (connectivityError) {
      console.error("[DB][quickValidateDatabase] Basic connectivity failed:", connectivityError);
      return false;
    }
    
    // Check SQLite version and database info
    try {
      const version = await drizzleDb.get(sql`SELECT sqlite_version() as version`);
      console.info("[DB][quickValidateDatabase] SQLite version:", version);
      
      const dbInfo = await drizzleDb.all(sql`PRAGMA database_list`);
      console.info("[DB][quickValidateDatabase] Database info:", dbInfo);
    } catch (infoError) {
      console.warn("[DB][quickValidateDatabase] Could not get database info:", infoError);
    }
    
    // List all tables for debugging
    const allTables = await drizzleDb.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
    );
    console.info("[DB][quickValidateDatabase] Found tables:", allTables.map((t: any) => t.name));
    
    // Also check all objects in sqlite_master for debugging
    const allObjects = await drizzleDb.all(
      sql`SELECT type, name FROM sqlite_master ORDER BY type, name`
    );
    console.info("[DB][quickValidateDatabase] All database objects:", allObjects);
    
    // Try a different approach to list tables
    const tablesAlt = await drizzleDb.all(
      sql`SELECT tbl_name FROM sqlite_master WHERE type='table'`
    );
    console.info("[DB][quickValidateDatabase] Tables (alternative query):", tablesAlt);
    
    // Try raw SQLite queries without Drizzle
    try {
      console.info("[DB][quickValidateDatabase] Trying raw SQLite queries...");
      const rawTables = db.getAllSync("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
      console.info("[DB][quickValidateDatabase] Raw SQLite tables:", rawTables);
      
      const rawObjects = db.getAllSync("SELECT type, name FROM sqlite_master ORDER BY type, name");
      console.info("[DB][quickValidateDatabase] Raw SQLite objects:", rawObjects);
      
      // Check if sqlite_master itself has any content
      const masterCount = db.getFirstSync("SELECT COUNT(*) as count FROM sqlite_master");
      console.info("[DB][quickValidateDatabase] sqlite_master row count:", masterCount);
      
      // Try to get all content from sqlite_master
      const allMaster = db.getAllSync("SELECT * FROM sqlite_master");
      console.info("[DB][quickValidateDatabase] All sqlite_master content:", allMaster);
      
      // Check database integrity
      const integrityCheck = db.getFirstSync("PRAGMA integrity_check");
      console.info("[DB][quickValidateDatabase] Integrity check:", integrityCheck);
      
      // Check if this might be an encrypted database
      const firstBytes = db.getFirstSync("PRAGMA schema_version");
      console.info("[DB][quickValidateDatabase] Schema version:", firstBytes);
      
      // Check user version (might indicate app version)
      const userVersion = db.getFirstSync("PRAGMA user_version");
      console.info("[DB][quickValidateDatabase] User version:", userVersion);
      
      // Check page count (should be > 0 for non-empty database)
      const pageCount = db.getFirstSync("PRAGMA page_count");
      console.info("[DB][quickValidateDatabase] Page count:", pageCount);
      
      // Check page size
      const pageSize = db.getFirstSync("PRAGMA page_size");
      console.info("[DB][quickValidateDatabase] Page size:", pageSize);
      
    } catch (rawError) {
      console.error("[DB][quickValidateDatabase] Raw SQLite queries failed:", rawError);
    }
    
    // Check if the main tables exist
    const categoriesTable = await drizzleDb.get(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='categories'`
    );
    
    const transactionsTable = await drizzleDb.get(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='transactions'`
    );
    
    const recurringTransactionsTable = await drizzleDb.get(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='recurring_transactions'`
    );
    
    const settingsTable = await drizzleDb.get(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='settings'`
    );
    
    console.info("[DB][quickValidateDatabase] Categories table found:", !!categoriesTable);
    console.info("[DB][quickValidateDatabase] Transactions table found:", !!transactionsTable);
    console.info("[DB][quickValidateDatabase] Recurring transactions table found:", !!recurringTransactionsTable);
    console.info("[DB][quickValidateDatabase] Settings table found:", !!settingsTable);
    
    const isValid = !!(categoriesTable && transactionsTable && recurringTransactionsTable && settingsTable);
    console.info("[DB][quickValidateDatabase] Validation result:", isValid);
    
    return isValid;
    
  } catch (error) {
    console.error("[DB][quickValidateDatabase] Quick validation error:", error);
    return false;
  } finally {
    if (db) {
      try {
        db.closeSync();
        console.info("[DB][quickValidateDatabase] Database connection closed");
      } catch (closeError) {
        console.warn("[DB][quickValidateDatabase] Error closing database:", closeError);
      }
    }
  }
};

/**
 * Very lenient validation - just check if the database is a valid SQLite file
 * This is useful for databases created by different tools (like Tauri) that might have different schemas
 */
export const lenientValidateDatabase = async (databasePath: string): Promise<boolean> => {
  let db: SQLite.SQLiteDatabase | null = null;
  
  try {
    console.info("[DB][lenientValidateDatabase] Opening database:", databasePath);
    db = SQLite.openDatabaseSync(databasePath);
    
    // Just check if it's a valid SQLite database
    try {
      const testQuery = db.getFirstSync("SELECT 1 as test");
      console.info("[DB][lenientValidateDatabase] Basic connectivity test:", testQuery);
      
      // Check if it has any tables at all
      const tableCount = db.getFirstSync("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'");
      console.info("[DB][lenientValidateDatabase] Table count:", tableCount);
      
      // If it has tables, it's probably a valid database
      return (tableCount as any)?.count > 0;
      
    } catch (queryError) {
      console.error("[DB][lenientValidateDatabase] Query failed:", queryError);
      return false;
    }
    
  } catch (error) {
    console.error("[DB][lenientValidateDatabase] Validation error:", error);
    return false;
  } finally {
    if (db) {
      try {
        db.closeSync();
        console.info("[DB][lenientValidateDatabase] Database connection closed");
      } catch (closeError) {
        console.warn("[DB][lenientValidateDatabase] Error closing database:", closeError);
      }
    }
  }
};

/**
 * Raw SQLite validation - bypasses Drizzle entirely for maximum compatibility
 * This should work with databases created by any tool (Tauri SQLx, etc.)
 */
export const rawSqliteValidateDatabase = async (databaseName: string): Promise<boolean> => {
  let db: SQLite.SQLiteDatabase | null = null;
  
  try {
    console.info("[DB][rawSqliteValidateDatabase] Opening database:", databaseName);
    db = SQLite.openDatabaseSync(databaseName);
    
    // Test basic connectivity with raw SQLite
    try {
      const testResult = db.getFirstSync("SELECT 1 as test");
      console.info("[DB][rawSqliteValidateDatabase] Basic connectivity:", testResult);
    } catch (connectError) {
      console.error("[DB][rawSqliteValidateDatabase] Basic connectivity failed:", connectError);
      return false;
    }
    
    // Get all tables using raw SQLite
    try {
      const tables = db.getAllSync("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
      console.info("[DB][rawSqliteValidateDatabase] Found tables:", tables);
      
      // Check for our specific tables
      const tableNames = tables.map((t: any) => t.name);
      const hasCategories = tableNames.includes('categories');
      const hasTransactions = tableNames.includes('transactions');
      const hasRecurringTransactions = tableNames.includes('recurring_transactions');
      const hasSettings = tableNames.includes('settings');
      
      console.info("[DB][rawSqliteValidateDatabase] Has categories table:", hasCategories);
      console.info("[DB][rawSqliteValidateDatabase] Has transactions table:", hasTransactions);
      console.info("[DB][rawSqliteValidateDatabase] Has recurring_transactions table:", hasRecurringTransactions);
      console.info("[DB][rawSqliteValidateDatabase] Has settings table:", hasSettings);
      
      // If we have all required tables, it's valid
      if (hasCategories && hasTransactions && hasRecurringTransactions && hasSettings) {
        console.info("[DB][rawSqliteValidateDatabase] All required tables found - validation passed");
        return true;
      }
      
      // If we have any tables, it's at least a valid database
      if (tableNames.length > 0) {
        console.info("[DB][rawSqliteValidateDatabase] Database has tables but not the expected schema");
        return true; // Allow import of any valid SQLite database
      }
      
      console.warn("[DB][rawSqliteValidateDatabase] No tables found in database");
      return false;
      
    } catch (queryError) {
      console.error("[DB][rawSqliteValidateDatabase] Table query failed:", queryError);
      return false;
    }
    
  } catch (error) {
    console.error("[DB][rawSqliteValidateDatabase] Validation error:", error);
    return false;
  } finally {
    if (db) {
      try {
        db.closeSync();
        console.info("[DB][rawSqliteValidateDatabase] Database connection closed");
      } catch (closeError) {
        console.warn("[DB][rawSqliteValidateDatabase] Error closing database:", closeError);
      }
    }
  }
};

