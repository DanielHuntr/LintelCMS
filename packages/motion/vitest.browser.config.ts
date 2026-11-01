import { defineConfig } from "vitest/config";

/*
 * Browser tests drive a real Chromium through Playwright, because jsdom has no Web
 * Animations API, no IntersectionObserver and no layout. Each file starts one browser.
 */
export default defineConfig({
  test: {
    include: ["src/browser-tests/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
