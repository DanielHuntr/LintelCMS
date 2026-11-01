import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // These need a real browser: see vitest.browser.config.ts.
    exclude: ["src/browser-tests/**", "node_modules/**"],
  },
});
