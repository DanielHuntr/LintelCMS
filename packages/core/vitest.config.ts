import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./src/testing/global-setup.ts"],
    // Database tests share one test database and empty it before each test,
    // so test files run one after another rather than side by side.
    fileParallelism: false,
  },
});
