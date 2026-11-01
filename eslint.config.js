// Shared lint rules for every package.
// The rules lean towards readable code: no `any` without a reason, no unused code,
// and consistent type imports so it is obvious what is a type and what is a value.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/migrations/**",
      "**/.next/**",
      "**/.astro/**",
      "**/next-env.d.ts",
      "packages/e2e/.admin-build/**",
      "packages/e2e/playwright-report/**",
      "packages/e2e/test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Playwright reads a fixture's dependencies from its first parameter, which has to be
    // an object pattern even when it needs none: `async ({}, use) => ...`.
    files: ["packages/e2e/**/*.ts"],
    rules: { "no-empty-pattern": "off" },
  },
  {
    files: ["packages/admin/**/*.{ts,tsx}", "starters/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
