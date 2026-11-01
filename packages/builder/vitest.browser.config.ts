import { defineConfig } from "vitest/config";

/*
 * Browser tests drive a real Chromium through Playwright, for what jsdom can't do: layout,
 * pointer dragging and the canvas frame's own script. Each file starts one browser.
 */
export default defineConfig({
  test: {
    include: ["src/browser-tests/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
