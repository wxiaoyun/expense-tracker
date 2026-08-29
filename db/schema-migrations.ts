import type * as SQLite from 'expo-sqlite';
import {
  DATABASE_SCHEMA_DEFINITION_SQL,
  TRANSACTION_TEMPLATE_CONSTRAINTS_SQL,
} from './schema-sql';
import {
  mapRecurringRowsToTemplates,
  type RecurringRowForTemplateMigration,
} from './template-migration-core';

export const LATEST_SCHEMA_VERSION = 3;

const V2_REQUIRED_COLUMNS: Record<string, string[]> = {
  categories: ['id', 'name', 'icon', 'color', 'is_preset', 'sort_order', 'created_at'],
  settings: ['key', 'value'],
  transactions: [
    'id',
    'amount',
    'transaction_date',
    'description',
    'category',
    'recurring_transaction_id',
    'verified',
    'notes',
    'created_at',
    'updated_at',
  ],
  recurring_transactions: [
    'id',
    'amount',
    'description',
    'category',
    'start_date',
    'last_charged',
    'recurrence_value',
    'created_at',
    'updated_at',
  ],
};

const logInfo = (stage: string, fromVersion: number, details: Record<string, unknown> = {}) => {
  console.info('[db.schema_migration] migration stage', {
    stage,
    from_version: fromVersion,
    to_version: LATEST_SCHEMA_VERSION,
    ...details,
  });
};

const count = (sqlite: SQLite.SQLiteDatabase, source: string): number =>
  Number(sqlite.getFirstSync<{ count: number }>(source)?.count ?? 0);

const migrateV2ToV3 = (
  sqlite: SQLite.SQLiteDatabase,
  fromVersion: number,
  onStage: (stage: string) => void,
) => {
  const enterStage = (stage: string, details: Record<string, unknown> = {}) => {
    onStage(stage);
    logInfo(stage, fromVersion, details);
  };

  enterStage('begin_v2_to_v3');
  sqlite.withTransactionSync(() => {
    enterStage('read_source_counts');
    const sourceTransactionCount = count(sqlite, 'SELECT COUNT(*) AS count FROM transactions');
    const sourceTemplateCount = count(sqlite, 'SELECT COUNT(*) AS count FROM recurring_transactions');
    const sourceLinkedCount = count(
      sqlite,
      'SELECT COUNT(*) AS count FROM transactions WHERE recurring_transaction_id IS NOT NULL',
    );
    const sourceRelationshipCount = count(
      sqlite,
      `SELECT COUNT(*) AS count
         FROM transactions
         JOIN recurring_transactions
           ON transactions.recurring_transaction_id = recurring_transactions.id`,
    );

    enterStage('read_recurring_rows', { count: sourceTemplateCount });
    const recurringRows = sqlite.getAllSync<RecurringRowForTemplateMigration>(`
      SELECT
        id,
        amount,
        description,
        category,
        start_date AS startDate,
        last_charged AS lastCharged,
        recurrence_value AS recurrenceValue,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM recurring_transactions
      ORDER BY created_at, id
    `);
    const templates = mapRecurringRowsToTemplates(recurringRows);

    enterStage('create_template_table');
    sqlite.execSync(`
      CREATE TABLE transaction_templates (
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
    `);

    enterStage('insert_templates', { count: templates.length });
    for (const template of templates) {
      sqlite.runSync(
        `INSERT INTO transaction_templates (
          id, name, normalized_name, amount, transaction_type, description, category,
          notes, verified, recurrence_value, start_date, schedule_cursor_at,
          schedule_active, deleted_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        template.id,
        template.name,
        template.normalizedName,
        template.amount,
        template.transactionType,
        template.description,
        template.category,
        template.notes,
        template.verified,
        template.recurrenceValue,
        template.startDate,
        template.scheduleCursorAt,
        template.scheduleActive,
        template.deletedAt,
        template.createdAt,
        template.updatedAt,
      );
    }

    enterStage('create_transactions_v3');
    sqlite.execSync(`
      CREATE TABLE transactions_v3 (
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
    `);

    enterStage('copy_transactions', { count: sourceTransactionCount });
    sqlite.execSync(`
      INSERT INTO transactions_v3 (
        id, amount, transaction_date, description, category, template_id,
        verified, notes, deleted_at, created_at, updated_at
      )
      SELECT
        id, amount, transaction_date, description, category,
        recurring_transaction_id AS template_id,
        verified, notes, NULL AS deleted_at, created_at, updated_at
      FROM transactions;
    `);

    enterStage('verify_migration');
    const migratedTransactionCount = count(sqlite, 'SELECT COUNT(*) AS count FROM transactions_v3');
    const migratedTemplateCount = count(sqlite, 'SELECT COUNT(*) AS count FROM transaction_templates');
    const migratedLinkedCount = count(
      sqlite,
      'SELECT COUNT(*) AS count FROM transactions_v3 WHERE template_id IS NOT NULL',
    );
    const migratedRelationshipCount = count(
      sqlite,
      `SELECT COUNT(*) AS count
         FROM transactions_v3
         JOIN transaction_templates
           ON transactions_v3.template_id = transaction_templates.id`,
    );
    const mismatchedLinks = count(
      sqlite,
      `SELECT COUNT(*) AS count
         FROM transactions AS source
         JOIN transactions_v3 AS migrated ON migrated.id = source.id
        WHERE NOT (migrated.template_id IS source.recurring_transaction_id)`,
    );

    if (
      migratedTransactionCount !== sourceTransactionCount ||
      migratedTemplateCount !== sourceTemplateCount ||
      migratedLinkedCount !== sourceLinkedCount ||
      migratedRelationshipCount !== sourceRelationshipCount ||
      mismatchedLinks !== 0
    ) {
      throw new Error(`Schema migration verification failed: ${JSON.stringify({
        sourceTransactionCount,
        migratedTransactionCount,
        sourceTemplateCount,
        migratedTemplateCount,
        sourceLinkedCount,
        migratedLinkedCount,
        sourceRelationshipCount,
        migratedRelationshipCount,
        mismatchedLinks,
      })}`);
    }

    enterStage('replace_v2_tables');
    sqlite.execSync(`
      DROP TABLE transactions;
      DROP TABLE recurring_transactions;
      ALTER TABLE transactions_v3 RENAME TO transactions;
    `);

    enterStage('create_v3_indexes');
    sqlite.execSync(`
      CREATE INDEX IF NOT EXISTS idx_categories_name ON categories (name);
      CREATE UNIQUE INDEX idx_templates_active_name
        ON transaction_templates (normalized_name) WHERE deleted_at IS NULL;
      CREATE INDEX idx_templates_category ON transaction_templates (category);
      CREATE INDEX idx_templates_schedule ON transaction_templates (schedule_active, deleted_at);
      CREATE INDEX idx_transactions_date ON transactions (transaction_date);
      CREATE INDEX idx_transactions_category ON transactions (category);
      CREATE INDEX idx_transactions_template ON transactions (template_id);
      CREATE INDEX idx_transactions_verified ON transactions (verified);
      CREATE INDEX idx_transactions_deleted ON transactions (deleted_at);
      PRAGMA user_version = 3;
    `);
  });
};

export const runSchemaMigrations = (sqlite: SQLite.SQLiteDatabase): void => {
  let fromVersion = -1;
  let stage = 'inspect_schema_version';

  try {
    logInfo(stage, fromVersion);
    fromVersion = Number(sqlite.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0);

    if (fromVersion === LATEST_SCHEMA_VERSION) {
      logInfo('schema_current', fromVersion);
      return;
    }

    if (fromVersion > LATEST_SCHEMA_VERSION || (fromVersion !== 0 && fromVersion !== 2)) {
      throw new Error(`Unsupported database schema version: ${fromVersion}`);
    }

    let existingTables: Set<string> | null = null;
    if (fromVersion === 0) {
      stage = 'inspect_existing_tables';
      logInfo(stage, fromVersion);
      existingTables = new Set(
        sqlite.getAllSync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        ).map(({ name }) => name),
      );

      if (existingTables.size === 0) {
        stage = 'enable_wal';
        logInfo(stage, fromVersion);
        sqlite.execSync('PRAGMA journal_mode = WAL;');

        stage = 'create_latest_schema';
        logInfo(stage, fromVersion);
        sqlite.withTransactionSync(() => {
          sqlite.execSync(DATABASE_SCHEMA_DEFINITION_SQL);
        });
        return;
      }

      fromVersion = 2;
    }

    stage = 'verify_v2_schema';
    logInfo(stage, fromVersion);
    existingTables ??= new Set(
      sqlite.getAllSync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      ).map(({ name }) => name),
    );
    for (const [table, expectedColumns] of Object.entries(V2_REQUIRED_COLUMNS)) {
      if (!existingTables.has(table)) {
        throw new Error(`V2 database is missing required table: ${table}`);
      }
      const actualColumns = sqlite
        .getAllSync<{ name: string }>(`PRAGMA table_info(${table})`)
        .map(({ name }) => name);
      if (
        actualColumns.length !== expectedColumns.length ||
        actualColumns.some((column, index) => column !== expectedColumns[index])
      ) {
        throw new Error(`V2 database has unexpected columns for table: ${table}`);
      }
    }

    stage = 'enable_wal';
    logInfo(stage, fromVersion);
    sqlite.execSync('PRAGMA journal_mode = WAL;');

    stage = 'migrate_v2_to_v3';
    migrateV2ToV3(sqlite, fromVersion, (migrationStage) => {
      stage = migrationStage;
    });
  } catch (error) {
    console.error('[db.schema_migration] migration failed', {
      stage,
      from_version: fromVersion,
      to_version: LATEST_SCHEMA_VERSION,
      error: String(error),
    });
    throw error;
  }
};
