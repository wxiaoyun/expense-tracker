import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginSolid } from "@rsbuild/plugin-solid";
import dotenv from "dotenv";
import { resolve } from "path";

const node_env = process.env.NODE_ENV;

if (node_env === "development") {
  dotenv.config();
}

export default defineConfig({
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
