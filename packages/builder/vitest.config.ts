import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // These need a real browser: see vitest.browser.config.ts.
    exclude: ["src/browser-tests/**", "node_modules/**"],
    // The editor tests drive the whole builder in jsdom; on a busy machine a few take longer
    // than the default five seconds.
    testTimeout: 20000,
  },
});
