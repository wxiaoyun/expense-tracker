import Database from "@tauri-apps/plugin-sql";

export const validateDatabase = async (filePath: string): Promise<boolean> => {
  try {
    const tempDb = await Database.load(`sqlite:${filePath}`);

    const tables = await tempDb.select<{ name: string }[]>(
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
        "end_date",
        "interval",
        "created_at",
        "updated_at",
      ],
      settings: ["id", "key", "value", "created_at", "updated_at"],
    };

    for (const [table, expectedColumns] of Object.entries(schemas)) {
      const tableInfo = await tempDb.select<{ name: string }[]>(
        `PRAGMA table_info(${table})`,
      );

      const hasAllColumns = expectedColumns.every((col) =>
        tableInfo.some((info) => info.name === col),
      );

      if (!hasAllColumns) {
        console.error(`[validateDatabase] Invalid schema for table ${table}`);
        return false;
      }
    }

    await tempDb.close();
    return true;
  } catch (error) {
    console.error("[validateDatabase] Database validation failed:", error);
    return false;
  }
};
