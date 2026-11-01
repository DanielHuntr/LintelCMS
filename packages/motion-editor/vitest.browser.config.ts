import { defineConfig } from "vitest/config";

/*
 * Browser tests drive a real Chromium through Playwright, for what jsdom cannot do: layout,
 * pointer capture and Web Animations. Each file starts one browser.
 */
export default defineConfig({
  test: {
    include: ["src/browser-tests/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
