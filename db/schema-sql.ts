export const LEGACY_DATABASE_NAME = 'expense_tracker.db';
export const DATABASE_NAME = 'expense_tracker_v2.db';

export const DATABASE_SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL UNIQUE,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    is_preset INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    amount REAL NOT NULL,
    transaction_date INTEGER NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    recurring_transaction_id TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (transaction_date);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
  CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions (recurring_transaction_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_verified ON transactions (verified);
  CREATE TABLE IF NOT EXISTS recurring_transactions (
    id TEXT PRIMARY KEY NOT NULL,
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    start_date INTEGER NOT NULL,
    last_charged INTEGER,
    recurrence_value TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_recurring_transactions_date ON recurring_transactions (start_date);
  CREATE INDEX IF NOT EXISTS idx_recurring_transactions_category ON recurring_transactions (category);
  CREATE INDEX IF NOT EXISTS idx_recurring_transactions_last_charged ON recurring_transactions (last_charged);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`;
