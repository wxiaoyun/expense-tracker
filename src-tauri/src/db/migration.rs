use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create_base_table",
        sql: r#"
          CREATE TABLE IF NOT EXISTS categories (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
          );

          CREATE TABLE IF NOT EXISTS recurring_transactions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              amount REAL NOT NULL,
              currency TEXT NOT NULL,
              description TEXT,
              category_id INTEGER NOT NULL,
              start_date INTEGER NOT NULL,
              end_date INTEGER,
              interval INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              FOREIGN KEY (category_id) REFERENCES categories(id)
          );

          CREATE TABLE IF NOT EXISTS transactions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              amount REAL NOT NULL,
              currency TEXT NOT NULL,
              transaction_date INTEGER NOT NULL,
              description TEXT,
              category_id INTEGER NOT NULL,
              recurring_transaction_id INTEGER,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              FOREIGN KEY (category_id) REFERENCES categories(id),
              FOREIGN KEY (recurring_transaction_id) REFERENCES recurring_transactions(id)
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
