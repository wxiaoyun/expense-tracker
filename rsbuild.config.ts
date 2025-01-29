import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginSolid } from "@rsbuild/plugin-solid";
import { codes } from "currency-codes";
import { resolve } from "path";

const host = process.env.TAURI_DEV_HOST;

// Update global.d.ts as well
const compileTime = {
  THEME_SETTING_KEY: JSON.stringify("theme"),
  CURRENCY_SETTING_KEY: JSON.stringify("currency"),
  WEEK_START_SETTING_KEY: JSON.stringify("week_start"),

  THEME_OPTIONS: JSON.stringify(["system", "light", "dark"]),
  CURRENCY_OPTIONS: JSON.stringify(codes()),
  WEEK_START_OPTIONS: JSON.stringify(["monday", "sunday"]),

  DEFAULT_CURRENCY: JSON.stringify("USD"),
  DEFAULT_WEEK_START: JSON.stringify("monday"),
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

  DATABASE_NAME: JSON.stringify(
    process.env.SQLITE_DATABASE_NAME ?? "expense_tracker",
  ),
  DATABASE_FILENAME: JSON.stringify(
    `${process.env.SQLITE_DATABASE_NAME ?? "expense_tracker"}.db`,
  ),

  IS_DEV: JSON.stringify(process.env.NODE_ENV === "development"),

  BUY_ME_A_COFFEE_URL: JSON.stringify("https://buymeacoffee.com/wxiaoyun"),
  GITHUB_URL: JSON.stringify("https://github.com/wxiaoyun/money-tracker"),
  GITHUB_ISSUE_URL: JSON.stringify(
    "https://github.com/wxiaoyun/money-tracker/issues",
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
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  source: {
    define: compileTime,
  },
  plugins: [
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
    }),
    pluginSolid(),
  ],
});
