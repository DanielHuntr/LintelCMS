import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // As in packages/core: GraphQL must load as one copy, the one Node uses.
    alias: [{ find: /^graphql$/, replacement: "graphql/index.js" }],
  },
  test: {
    include: ["src/server/**/*.test.ts"],
    // A Lintel server on a fresh built-in database takes a few seconds to start.
    hookTimeout: 120_000,
  },
});
