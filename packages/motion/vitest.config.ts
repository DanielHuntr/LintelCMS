import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/browser-tests/**"],
    // The cache keys a module on its own text only, so a new effect module was missed by the
    // catalogue test's dynamic import until the cache was cleared.
    fsModuleCache: false,
  },
});
