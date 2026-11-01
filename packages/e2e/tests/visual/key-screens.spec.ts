import type { Page } from "@playwright/test";
import { expect, test } from "../../src/fixtures/lintel-test.js";

/**
 * Screenshots of the screens people spend most time in, compared with the baselines in
 * __screenshots__. A difference over the tolerance in playwright.config.ts fails the test
 * and the report shows the two side by side. After an intended change, update them with
 * `pnpm e2e:update-snapshots` and commit the new images.
 *
 * Baselines are made on Linux in Chromium (as CI runs); fonts render differently elsewhere,
 * so other systems skip these.
 */

test.skip(process.platform !== "linux", "Screenshot baselines are made on Linux.");
test.use({ reducedMotion: "reduce" });

/** Times and dates change on every run, so they're covered up before comparing. */
function changingParts(page: Page) {
  return [
    page.locator("time"),
    page.getByRole("region", { name: "Status" }).getByRole("paragraph"),
    page.getByRole("region", { name: "History" }),
  ];
}

async function expectScreen(page: Page, name: string): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page).toHaveScreenshot(`${name}.png`, { mask: changingParts(page) });
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test("dashboard", async ({ page }) => {
      await page.goto("/");
      await expectScreen(page, `dashboard-${colorScheme}`);
    });

    test("blog posts list", async ({ page }) => {
      await page.goto("/content/posts");
      await expectScreen(page, `posts-list-${colorScheme}`);
    });

    test("page editor with blocks", async ({ page, content }) => {
      await page.goto(`/content/pages/${content.pages.home.id}`);
      await expectScreen(page, `page-editor-${colorScheme}`);
    });

    test("media library", async ({ page }) => {
      await page.goto("/media");
      await expect(
        page.getByRole("list", { name: "Media files" }).getByRole("button").first(),
      ).toBeVisible();
      // The thumbnails are decorative (alt=""), so wait for the pictures themselves.
      await page.waitForFunction(() =>
        [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      );
      await expectScreen(page, `media-library-${colorScheme}`);
    });
  });
}

test("post editor", async ({ page, content }) => {
  await page.goto(`/content/posts/${content.posts.draft.id}`);
  await expectScreen(page, "post-editor");
});

test("settings", async ({ page }) => {
  await page.goto("/settings");
  await expectScreen(page, "settings");
});

test("content type editor", async ({ page }) => {
  await page.goto("/settings/content-types/post");
  await expectScreen(page, "content-type-editor");
});

test.describe("signed out", () => {
  test.use({ signedInAs: null });

  test("sign in", async ({ page }) => {
    await page.goto("/sign-in");
    await expectScreen(page, "sign-in");
  });
});

test.describe("first run", () => {
  test.use({ site: "fresh", signedInAs: null });

  test("setup welcome", async ({ page }) => {
    await page.goto("/setup");
    await expectScreen(page, "setup-welcome");
  });
});
