import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { categories, settings, transactionTemplates, transactions } from './schema';
import { runSchemaMigrations } from './schema-migrations';
import { DATABASE_NAME } from './schema-sql';

export const sqlite = SQLite.openDatabaseSync(DATABASE_NAME, { enableChangeListener: false });

runSchemaMigrations(sqlite);

export const db = drizzle(sqlite);

export { categories, settings, transactionTemplates, transactions };
