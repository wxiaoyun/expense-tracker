export const APP_NAME = "expense_tracker";
export const DATABASE_FILENAME = `${APP_NAME}.db`;
// SQLite Plugin will create a directory called SQLite and put the database file in it
export const DATABASE_PATH = `SQLite/${DATABASE_FILENAME}`;
export const CSV_FILENAME = `${APP_NAME}.csv`;

export const EXPORT_DIR = "exports";
export const BACKUP_DIR = "backups";
export const CSV_DELIMITER = ",";

export const GITHUB_ISSUE_URL =
  "https://github.com/wxiaoyun/expense-tracker/issues";
export const GITHUB_URL = "https://github.com/wxiaoyun/expense-tracker";
export const BUY_ME_A_COFFEE_URL = "https://buymeacoffee.com/wxiaoyun";

export const BACKUP_INTERVAL_OPTIONS = [
  "off",
  "daily",
  "weekly",
  "monthly",
] as const;
export type BackupInterval = (typeof BACKUP_INTERVAL_OPTIONS)[number];

export const THEME_OPTIONS = ["system", "light", "dark"] as const;
export type Theme = (typeof THEME_OPTIONS)[number];
export type ResolvedTheme = (typeof THEME_OPTIONS)[1 | 2];

export const WEEK_START_OPTIONS = ["sunday", "monday"] as const;
export type WeekStart = (typeof WEEK_START_OPTIONS)[number];
export type WeekStartsOn = 0 | 1;

export const dateRangeOptions = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "all",
] as const;
export type DateRange = (typeof dateRangeOptions)[number];
