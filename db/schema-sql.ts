export const LEGACY_DATABASE_NAME = 'expense_tracker.db';
export const DATABASE_NAME = 'expense_tracker_v2.db';

export const DATABASE_SCHEMA_DEFINITION_SQL = `
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
  CREATE TABLE IF NOT EXISTS transaction_templates (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    amount REAL,
    transaction_type TEXT,
    description TEXT,
    category TEXT,
    notes TEXT,
    verified INTEGER,
    recurrence_value TEXT,
    start_date INTEGER,
    schedule_cursor_at INTEGER,
    schedule_active INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_active_name
    ON transaction_templates (normalized_name) WHERE deleted_at IS NULL;
  CREATE INDEX IF NOT EXISTS idx_templates_category ON transaction_templates (category);
  CREATE INDEX IF NOT EXISTS idx_templates_schedule ON transaction_templates (schedule_active, deleted_at);
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    amount REAL NOT NULL,
    transaction_date INTEGER NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    template_id TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    deleted_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (transaction_date);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions (category);
  CREATE INDEX IF NOT EXISTS idx_transactions_template ON transactions (template_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_verified ON transactions (verified);
  CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions (deleted_at);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  PRAGMA user_version = 3;
`;

export const DATABASE_SCHEMA_SQL = `
  PRAGMA journal_mode = WAL;
  ${DATABASE_SCHEMA_DEFINITION_SQL}
`;
