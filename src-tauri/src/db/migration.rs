use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
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
            recurrence_type TEXT NOT NULL,
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
    }]
}
