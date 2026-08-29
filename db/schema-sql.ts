export const LEGACY_DATABASE_NAME = 'expense_tracker.db';
export const DATABASE_NAME = 'expense_tracker_v2.db';

export const TRANSACTION_TEMPLATE_CONSTRAINTS_SQL = `
    CONSTRAINT chk_templates_amount CHECK (
      amount IS NULL OR (
        typeof(amount) IN ('integer', 'real')
        AND amount > 0
        AND amount < 9e999
      )
    ),
    CONSTRAINT chk_templates_transaction_type CHECK (
      transaction_type IS NULL OR transaction_type IN ('income', 'expense')
    ),
    CONSTRAINT chk_templates_verified CHECK (
      verified IS NULL OR verified IN (0, 1)
    ),
    CONSTRAINT chk_templates_schedule_active CHECK (schedule_active IN (0, 1)),
    CONSTRAINT chk_templates_reusable_field CHECK (
      amount IS NOT NULL
      OR transaction_type IS NOT NULL
      OR (description IS NOT NULL AND trim(description) <> '')
      OR (category IS NOT NULL AND trim(category) <> '')
      OR (notes IS NOT NULL AND trim(notes) <> '')
      OR verified IS NOT NULL
      OR (schedule_active = 0 AND recurrence_value IS NOT NULL)
    ),
    CONSTRAINT chk_templates_manual_schedule CHECK (
      recurrence_value IS NOT NULL OR (
        start_date IS NULL
        AND schedule_cursor_at IS NULL
        AND schedule_active = 0
      )
    ),
    CONSTRAINT chk_templates_active_schedule CHECK (
      schedule_active = 0 OR (
        recurrence_value IS NOT NULL
        AND trim(recurrence_value) <> ''
        AND amount IS NOT NULL
        AND description IS NOT NULL
        AND trim(description) <> ''
        AND typeof(start_date) = 'integer'
        AND typeof(schedule_cursor_at) = 'integer'
        AND schedule_cursor_at >= start_date
      )
    )`;

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
    updated_at INTEGER NOT NULL,
    ${TRANSACTION_TEMPLATE_CONSTRAINTS_SQL}
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
