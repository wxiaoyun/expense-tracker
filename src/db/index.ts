import Database from '@tauri-apps/plugin-sql';

const databaseName = process.env.SQLITE_DATABASE_NAME ?? "expense_tracker"
const databasePath = `sqlite:${databaseName}.db`

export const db = await Database.load(databasePath);