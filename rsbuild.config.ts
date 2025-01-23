import { defineConfig } from "@rsbuild/core";
import { pluginBabel } from "@rsbuild/plugin-babel";
import { pluginSolid } from "@rsbuild/plugin-solid";
import dotenv from "dotenv";
import { resolve } from "path";

dotenv.config();

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  tools: {
    rspack: (config, { rspack }) => {
      config.plugins?.push(
        new rspack.EnvironmentPlugin("SQLITE_DATABASE_NAME"),
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
