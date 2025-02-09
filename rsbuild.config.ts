import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { pluginSolid } from "@rsbuild/plugin-solid";
import { codes } from "currency-codes";
import { resolve } from "path";

const host = process.env.TAURI_DEV_HOST;
const databaseName = process.env.SQLITE_DATABASE_NAME ?? "expense_tracker";

// Update global.d.ts as well
const compileTime = {
  EXPORT_DIR: JSON.stringify("export"),

  THEME_SETTING_KEY: JSON.stringify("theme"),
  THEME_OPTIONS: JSON.stringify(["system", "light", "dark"]),
  DEFAULT_COLOR_SCHEME: JSON.stringify([
    "#f94144",
    "#f3722c",
    "#f8961e",
    "#f9844a",
    "#f9c74f",
    "#90be6d",
    "#43aa8b",
    "#4d908e",
    "#577590",
    "#277da1",
  ]),

  CURRENCY_SETTING_KEY: JSON.stringify("currency"),
  CURRENCY_OPTIONS: JSON.stringify(codes()),
  DEFAULT_CURRENCY: JSON.stringify("USD"),

  WEEK_START_SETTING_KEY: JSON.stringify("week_start"),
  WEEK_START_OPTIONS: JSON.stringify(["monday", "sunday"]),
  DEFAULT_WEEK_START: JSON.stringify("monday"),

  BACKUP_DIR: JSON.stringify("backup"),
  BACKUP_INTERVAL_SETTING_KEY: JSON.stringify("backup_interval"),
  LAST_BACKUP_SETTING_KEY: JSON.stringify("last_backup"),
  BACKUP_INTERVAL_OPTIONS: JSON.stringify([
    "off",
    "daily",
    "weekly",
    "monthly",
  ]),
  DEFAULT_BACKUP_INTERVAL: JSON.stringify("off"),

  CLIPBOARD_CMD_PREFIX: JSON.stringify("clipboard-cmd:"),
  CLIPBOARD_EXEC_SETTING_KEY: JSON.stringify("clipboard_exec"),

  CSV_DELIMITER: JSON.stringify(","),
  CSV_FILENAME: JSON.stringify(`${databaseName}.csv`),
  DATABASE_NAME: JSON.stringify(databaseName),
  DATABASE_FILENAME: JSON.stringify(`${databaseName}.db`),

  IS_DEV: JSON.stringify(process.env.NODE_ENV === "development"),

  BUY_ME_A_COFFEE_URL: JSON.stringify("https://buymeacoffee.com/wxiaoyun"),
  GITHUB_URL: JSON.stringify("https://github.com/wxiaoyun/expense-tracker"),
  GITHUB_ISSUE_URL: JSON.stringify(
    "https://github.com/wxiaoyun/expense-tracker/issues",
  ),
};

export default defineConfig({
  server: {
    host,
    strictPort: true,
  },
  dev: {
    client: host
      ? {
          protocol: "ws",
          host,
          port: 3000,
        }
      : undefined,
  },
  output: {
    polyfill: "usage",
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  performance: {
    removeConsole: ["error", "info", "warn", "log"],
  },
  source: {
    define: compileTime,
  },
  plugins: [
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
    }),
    pluginSolid(),
    pluginNodePolyfill(),
  ],
});
