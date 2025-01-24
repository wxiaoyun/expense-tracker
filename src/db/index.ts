import Database from "@tauri-apps/plugin-sql";

const databaseName = process.env.SQLITE_DATABASE_NAME ?? "expense_tracker";
const databasePath = `sqlite:${databaseName}.db`;

export const db = await Database.load(databasePath);

export { default as recurringTransactions } from "./recurring_transactions";
export { default as settings } from "./settings";
export { default as transactions } from "./transactions";
