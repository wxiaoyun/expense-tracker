// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const reactCompiler = require("eslint-plugin-react-compiler");
const expoConfig = require("eslint-config-expo/flat");
const pluginQuery = require("@tanstack/eslint-plugin-query");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  reactCompiler.configs.recommended,
  ...pluginQuery.configs["flat/recommended"],
]);
