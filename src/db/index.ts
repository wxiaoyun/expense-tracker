import Database from "@tauri-apps/plugin-sql";
import Knex from "knex";

const dbUri = `sqlite:${DATABASE_FILENAME}`;
export const TRANSACTIONS_TABLE = "transactions";
export const RECURRING_TRANSACTIONS_TABLE = "recurring_transactions";
export const SETTINGS_TABLE = "settings";

// This is used purely to build queries
export const sql = Knex({
  client: "sqlite3",
  useNullAsDefault: true,
});
export let db: Database;

export const initDb = async () => {
  db = await Database.load(dbUri);
  console.info("[DB][initDb] Database initialized");
};

export const reloadDb = async () => {
  db = await Database.load(dbUri);
  console.info("[DB][reloadDb] Database reloaded");
};

export { default as recurringTransactions } from "./recurring_transactions";
export { default as settings } from "./settings";
export { default as transactions } from "./transactions";
