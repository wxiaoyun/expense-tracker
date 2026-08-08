import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { categories, transactions, recurringTransactions, settings } from './schema';

// Open the database
export const db = drizzle(
  SQLite.openDatabaseSync('expense_tracker.db', { enableChangeListener: false })
);

// Export tables for convenience
export { categories, transactions, recurringTransactions, settings };
