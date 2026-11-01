import type { Page } from "@playwright/test";
import { expect, test } from "../../src/fixtures/lintel-test.js";

/**
 * People who ask their device for less motion get none: every transition and animation in
 * the admin collapses to (almost) nothing. The same screens with motion allowed do move,
 * so this would notice if the reduced-motion rule stopped applying.
 */

async function longestMotion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const seconds = (value: string) =>
      Math.max(
        ...value
          .split(",")
          .map((part) => (part.trim().endsWith("ms") ? parseFloat(part) / 1000 : parseFloat(part))),
      );
    let longest = 0;
    for (const element of document.querySelectorAll("*")) {
      const style = getComputedStyle(element);
      if (style.transitionProperty !== "none") {
        longest = Math.max(longest, seconds(style.transitionDuration));
      }
      if (style.animationName !== "none") {
        longest = Math.max(longest, seconds(style.animationDuration));
      }
    }
    return longest;
  });
}

async function openThingsThatMove(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.getByRole("button", { name: "Help for this screen" }).click();
  await page.getByRole("button", { name: "Close help" }).waitFor();
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("dialog", { name: "Search Lintel" }).waitFor();
}

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("nothing in the admin animates", async ({ page, content }) => {
    await openThingsThatMove(page, "/media");
    expect(await longestMotion(page)).toBeLessThanOrEqual(0.001);

    await page.keyboard.press("Escape");
    await page.goto(`/content/pages/${content.pages.home.id}`);
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("dialog", { name: "Add a block" }).waitFor();
    expect(await longestMotion(page)).toBeLessThanOrEqual(0.001);
  });
});

test.describe("with motion allowed", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the same screens do use motion", async ({ page }) => {
    await openThingsThatMove(page, "/media");
    expect(await longestMotion(page)).toBeGreaterThan(0.05);
  });
});
