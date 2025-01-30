import Database from "@tauri-apps/plugin-sql";

export const validateDatabase = async (dbPath: string): Promise<boolean> => {
  try {
    const db = await Database.load(`sqlite:${dbPath}`);

    const tables = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table'",
    );

    const requiredTables = [
      "recurring_transactions",
      "transactions",
      "settings",
    ];
    const hasAllTables = requiredTables.every((table) =>
      tables.some((t) => t.name === table),
    );

    if (!hasAllTables) {
      console.error("[validateDatabase] Missing required tables");
      return false;
    }

    const schemas = {
      transactions: [
        "id",
        "amount",
        "transaction_date",
        "description",
        "category",
        "recurring_transaction_id",
        "created_at",
        "updated_at",
      ],
      recurring_transactions: [
        "id",
        "amount",
        "description",
        "category",
        "start_date",
        "last_charged",
        "recurrence_value",
        "created_at",
        "updated_at",
      ],
      settings: ["id", "key", "value", "created_at", "updated_at"],
    };

    for (const [table, expectedColumns] of Object.entries(schemas)) {
      const tableInfo = await db.select<{ name: string }[]>(
        `PRAGMA table_info(${table})`,
      );

      console.info(
        "[validateDatabase] %s tableInfo: %o, expectedColumns: %o",
        table,
        tableInfo,
        expectedColumns,
      );

      const hasAllColumns = expectedColumns.every((col) =>
        tableInfo.some((info) => info.name === col),
      );

      if (!hasAllColumns) {
        console.error(`[validateDatabase] Invalid schema for table ${table}`);
        return false;
      }
    }

    await db.close();
    return true;
  } catch (error) {
    console.error("[validateDatabase] Database validation failed:", error);
    return false;
  }
};
