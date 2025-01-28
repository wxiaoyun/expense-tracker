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

  DEFAULT_CURRENCY: JSON.stringify("USD"),
  CURRENCY_OPTIONS: JSON.stringify(codes()),
  THEME_OPTIONS: JSON.stringify(["system", "light", "dark"]),

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
