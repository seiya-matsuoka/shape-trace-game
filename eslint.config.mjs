import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
    },
  },
  {
    ignores: ["dist", "node_modules", "*.{cjs,cts}", "*.config.*"],
  },
];
