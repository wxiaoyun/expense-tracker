import Database from "@tauri-apps/plugin-sql";

const dbUri = `sqlite:${DATABASE_FILENAME}`;

export let db: Database;

export const initDb = async () => {
  db = await Database.load(dbUri);
  db.execute("PRAGMA journal_mode=WAL");
};

export const reloadDb = async () => {
  db = await Database.load(dbUri);
  console.info("[DB][reloadDb] Database reloaded");
};

export { default as recurringTransactions } from "./recurring_transactions";
export { default as settings } from "./settings";
export { default as transactions } from "./transactions";
