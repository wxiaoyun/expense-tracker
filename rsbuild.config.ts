import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginSolid } from "@rsbuild/plugin-solid";
import { resolve } from "path";

const host = process.env.TAURI_DEV_HOST;

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
  tools: {
    rspack: (config, { rspack }) => {
      config.plugins?.push(
        new rspack.EnvironmentPlugin([
          "SQLITE_DATABASE_NAME",
          "BUY_ME_A_COFFEE_URL",
          "GITHUB_URL",
          "GITHUB_ISSUE_URL",
        ]),
      );
      return config;
    },
  },
  plugins: [
    pluginBabel({
      include: /\.(?:jsx|tsx)$/,
    }),
    pluginSolid(),
  ],
});
