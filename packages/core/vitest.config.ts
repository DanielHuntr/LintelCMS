import { defineConfig } from "vitest/config";
import { useMysqlTablesInTests } from "./src/testing/use-mysql-tables-in-tests.js";

const onMysql = /^(mysql|mariadb):/.test(process.env.TEST_DATABASE_URL ?? "");

export default defineConfig({
  plugins: onMysql ? [useMysqlTablesInTests()] : [],
  // Runs side by side (see scripts/test-suite-on-mysql.mjs) can't share a cache on Windows.
  ...(process.env.LINTEL_TEST_CACHE_FOLDER
    ? { cacheDir: process.env.LINTEL_TEST_CACHE_FOLDER }
    : {}),
  resolve: {
    // graphql 16 ships both CommonJS and ES module builds. Node (and so GraphQL Yoga) loads
    // the CommonJS one; without this, Vite would hand our code the other, and GraphQL
    // refuses to mix types from the two.
    alias: [{ find: /^graphql$/, replacement: "graphql/index.js" }],
  },
  test: {
    globalSetup: ["./src/testing/global-setup.ts"],
    setupFiles: onMysql ? ["./src/testing/refuse-postgres-tables-on-mysql.ts"] : [],
    // Database tests share one test database and empty it before each test,
    // so test files run one after another rather than side by side.
    fileParallelism: false,
  },
});
