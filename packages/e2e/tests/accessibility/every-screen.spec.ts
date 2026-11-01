import { expectNoSeriousAccessibilityProblems } from "../../src/accessibility/axe-check.js";
import { adminScreens } from "../../src/accessibility/admin-screens.js";
import { expect, test } from "../../src/fixtures/lintel-test.js";
import { setupScreens } from "../../src/screens/setup-wizard.js";

/**
 * axe-core on every admin screen, in light and in dark mode. Fails on serious and critical
 * problems; see the attached JSON on each test for the minor ones.
 */

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme, reducedMotion: "reduce" });

    for (const screen of adminScreens) {
      test(`${screen.name} has no serious accessibility problems`, async ({
        page,
        content,
      }, testInfo) => {
        await page.goto(screen.path(content));
        await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
        await page.waitForLoadState("networkidle");
        await screen.open?.(page);
        await expectNoSeriousAccessibilityProblems(
          page,
          `${screen.name} (${colorScheme})`,
          testInfo,
        );
      });
    }

    test.describe("signed out", () => {
      test.use({ signedInAs: null });

      test("Sign in has no serious accessibility problems", async ({ page }, testInfo) => {
        await page.goto("/sign-in");
        await expect(
          page.getByRole("heading", { level: 1, name: "Sign in to Lintel" }),
        ).toBeVisible();
        await expectNoSeriousAccessibilityProblems(page, `Sign in (${colorScheme})`, testInfo);
      });
    });

    test.describe("first run", () => {
      test.use({ site: "fresh", signedInAs: null });

      test("the setup steps have no serious accessibility problems", async ({ page }, testInfo) => {
        await page.goto("/setup");
        await expectNoSeriousAccessibilityProblems(
          page,
          `Setup: welcome (${colorScheme})`,
          testInfo,
        );
        const screens = setupScreens(page);
        await screens.getStarted.click();
        await expect(screens.databaseChoice).toBeVisible();
        await expectNoSeriousAccessibilityProblems(
          page,
          `Setup: database (${colorScheme})`,
          testInfo,
        );
        await screens.continue.click();
        await screens.continue.click();
        await expect(screens.nameField).toHaveAttribute("aria-invalid", "true");
        await expectNoSeriousAccessibilityProblems(
          page,
          `Setup: name with an error (${colorScheme})`,
          testInfo,
        );
      });
    });
  });
}
