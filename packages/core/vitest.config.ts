import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // graphql 16 ships both CommonJS and ES module builds. Node (and so GraphQL Yoga) loads
    // the CommonJS one; without this, Vite would hand our code the other, and GraphQL
    // refuses to mix types from the two.
    alias: [{ find: /^graphql$/, replacement: "graphql/index.js" }],
  },
  test: {
    globalSetup: ["./src/testing/global-setup.ts"],
    // Database tests share one test database and empty it before each test,
    // so test files run one after another rather than side by side.
    fileParallelism: false,
  },
});
