import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { categories, transactions, recurringTransactions, settings } from './schema';
import { DATABASE_NAME, DATABASE_SCHEMA_SQL } from './schema-sql';

export const sqlite = SQLite.openDatabaseSync(DATABASE_NAME, { enableChangeListener: false });

const initializeDatabase = () => {
  console.info('[db.init][stage=create_schema] ensuring database schema');
  try {
    sqlite.execSync(DATABASE_SCHEMA_SQL);
    console.info('[db.init][stage=create_schema] database schema ready');
  } catch (error) {
    console.error('[db.init][stage=create_schema] database initialization failed', {
      error: String(error),
    });
    throw error;
  }
};

initializeDatabase();

export const db = drizzle(sqlite);

// Export tables for convenience
export { categories, transactions, recurringTransactions, settings };
