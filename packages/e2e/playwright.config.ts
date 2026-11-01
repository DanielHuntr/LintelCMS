import { defineConfig, devices } from "@playwright/test";

/**
 * Lintel's browser tests. Each test worker runs its own copy of Lintel (see src/site), so
 * the suite runs in parallel without tests seeing each other's data.
 *
 *   journeys        what people do in the admin, start to finish
 *   accessibility   axe on every screen in light and dark, keyboard-only journeys
 *   visual          screenshots of key screens, compared with the committed baselines
 *   performance     JavaScript size, Largest Contentful Paint and API response budgets
 *
 * Firefox and WebKit run the journeys too when installed and listed in
 * LINTEL_E2E_BROWSERS (for example `LINTEL_E2E_BROWSERS=firefox,webkit pnpm e2e`).
 */

const inContinuousIntegration = Boolean(process.env.CI);
const extraBrowsers = (process.env.LINTEL_E2E_BROWSERS ?? "").split(",").filter(Boolean);

const sameEverywhere = {
  locale: "en-GB",
  timezoneId: "UTC",
  viewport: { width: 1280, height: 800 },
};

export default defineConfig({
  testDir: "tests",
  globalSetup: "./src/global-setup.ts",
  fullyParallel: true,
  forbidOnly: inContinuousIntegration,
  retries: inContinuousIntegration ? 1 : 0,
  // Each worker runs a whole Lintel (several hundred MB for the built-in database), so one
  // at a time locally; pass --workers to use more on a big machine.
  workers: inContinuousIntegration ? 2 : 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      // Small differences in font smoothing are fine; a moved or missing element is not.
      maxDiffPixelRatio: 0.01,
      threshold: 0.2,
      animations: "disabled",
      caret: "hide",
    },
  },
  snapshotPathTemplate: "{testDir}/{testFileDir}/__screenshots__/{testFileName}/{arg}{ext}",
  reporter: inContinuousIntegration
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    ...sameEverywhere,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "journeys",
      testDir: "tests/journeys",
      use: { ...devices["Desktop Chrome"], ...sameEverywhere },
    },
    {
      name: "accessibility",
      testDir: "tests/accessibility",
      use: { ...devices["Desktop Chrome"], ...sameEverywhere },
    },
    {
      name: "visual",
      testDir: "tests/visual",
      use: { ...devices["Desktop Chrome"], ...sameEverywhere },
    },
    {
      name: "performance",
      testDir: "tests/performance",
      // Timings are only meaningful without other tests competing for the processor.
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"], ...sameEverywhere },
    },
    ...extraBrowsers.map((browser) => ({
      name: `journeys-${browser}`,
      testDir: "tests/journeys",
      use: {
        ...(browser === "webkit" ? devices["Desktop Safari"] : devices["Desktop Firefox"]),
        ...sameEverywhere,
      },
    })),
  ],
});
