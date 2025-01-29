import Database from "@tauri-apps/plugin-sql";

const dbUri = `sqlite:${DATABASE_FILENAME}`;

export let db = await Database.load(dbUri);

export const reloadDb = async () => {
  db = await Database.load(dbUri);
  console.info("[DB][reloadDb] Database reloaded");
};

export { default as recurringTransactions } from "./recurring_transactions";
export { default as settings } from "./settings";
export { default as transactions } from "./transactions";
