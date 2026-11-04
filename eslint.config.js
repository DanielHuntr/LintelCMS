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
      "**/migrations-mysql/**",
      "**/.next/**",
      "**/.astro/**",
      "**/next-env.d.ts",
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
    // Read by drizzle-kit, which needs a list of exports that an ES module can't give.
    files: ["packages/core/src/database/dialect/mysql-schema.cjs"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // The files shipped in the shared-hosting package: plain CommonJS that hosting control
    // panels load directly, and that prints to the terminal.
    files: ["packages/core/src/hosting/files/*.cjs"],
    // PhusionPassenger is the global Passenger gives the apps it runs.
    languageOptions: { sourceType: "commonjs", globals: { PhusionPassenger: "readonly" } },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      // `catch (error)` with the error unused, for old versions of Node.js.
      "@typescript-eslint/no-unused-vars": ["error", { caughtErrors: "none" }],
      "no-console": "off",
      "no-var": "off",
    },
  },
  {
    files: [
      "packages/admin/**/*.{ts,tsx}",
      "packages/builder/**/*.{ts,tsx}",
      "packages/motion-editor/**/*.{ts,tsx}",
      "starters/**/*.{ts,tsx}",
    ],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
