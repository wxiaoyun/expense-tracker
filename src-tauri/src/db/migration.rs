use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_base_table",
            sql: r#"
              CREATE TABLE IF NOT EXISTS recurring_transactions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  amount REAL NOT NULL,
                  description TEXT,
                  category TEXT NOT NULL,
                  start_date INTEGER NOT NULL,
                  last_charged INTEGER,
                  recurrence_value TEXT NOT NULL,
                  created_at INTEGER NOT NULL,
                  updated_at INTEGER NOT NULL
              );

              CREATE TABLE IF NOT EXISTS transactions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  amount REAL NOT NULL,
                  transaction_date INTEGER NOT NULL,
                  description TEXT,
                  category TEXT NOT NULL,
                  recurring_transaction_id INTEGER,
                  verified INTEGER NOT NULL DEFAULT 0,
                  created_at INTEGER NOT NULL,
                  updated_at INTEGER NOT NULL
              );

              CREATE TABLE IF NOT EXISTS settings (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  key TEXT NOT NULL UNIQUE,
                  value TEXT NOT NULL,
                  created_at INTEGER NOT NULL,
                  updated_at INTEGER NOT NULL
              );
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 1,
            description: "drop_base_table",
            sql: r#"
              DROP TABLE IF EXISTS settings;
              DROP TABLE IF EXISTS transactions;
              DROP TABLE IF EXISTS recurring_transactions;
            "#,
            kind: MigrationKind::Down,
        },
        Migration {
            version: 2,
            description: "add_indexes",
            sql: r#"
              CREATE INDEX idx_transactions_date ON transactions(transaction_date);
              CREATE INDEX idx_transactions_category ON transactions(category);
              CREATE INDEX idx_transactions_recurring ON transactions(recurring_transaction_id);
              CREATE INDEX idx_transactions_verified ON transactions(verified);
              CREATE INDEX idx_recurring_transactions_date ON recurring_transactions(start_date);
              CREATE INDEX idx_recurring_transactions_category ON recurring_transactions(category);
              CREATE INDEX idx_recurring_transactions_last_charged ON recurring_transactions(last_charged);
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "remove_indexes",
            sql: r#"
              DROP INDEX IF EXISTS idx_transactions_date;
              DROP INDEX IF EXISTS idx_transactions_category;
              DROP INDEX IF EXISTS idx_transactions_recurring;
              DROP INDEX IF EXISTS idx_transactions_verified;
              DROP INDEX IF EXISTS idx_recurring_transactions_date;
              DROP INDEX IF EXISTS idx_recurring_transactions_category;
              DROP INDEX IF EXISTS idx_recurring_transactions_last_charged;
            "#,
            kind: MigrationKind::Down,
        },
    ]
}
