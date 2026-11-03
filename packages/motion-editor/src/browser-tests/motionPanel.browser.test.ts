import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser, openMotionPanel } from "./harness.js";

// Undefined only if Chromium failed to start, which beforeAll reports.
let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

describe("adding motion in a narrow side panel", () => {
  it("fits all five moments without cutting a word short", async () => {
    // The builder's side panel leaves about 288px for its content.
    const page = await openMotionPanel(browser, { width: 260, reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "Add motion" }).click();
    const group = page.getByRole("radiogroup", { name: "When it moves" });
    const clipped = await group.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return [...element.querySelectorAll('[role="radio"]')].flatMap((radio) => {
        const words = radio.querySelector("span");
        const box = radio.getBoundingClientRect();
        const fits =
          words !== null &&
          words.scrollWidth <= words.clientWidth + 1 &&
          box.left >= bounds.left - 1 &&
          box.right <= bounds.right + 1;
        return fits ? [] : [radio.textContent];
      });
    });
    expect(clipped).toEqual([]);
    await page.close();
  });

  it("plays each tile's little movement, and keeps it still for people who ask for less motion", async () => {
    const moving = await openMotionPanel(browser, { width: 288, reducedMotion: "no-preference" });
    await moving.getByRole("button", { name: "Add motion" }).click();
    await moving.getByRole("radio", { name: "Appears" }).click();
    const playing = await moving.evaluate(
      () =>
        [...document.querySelectorAll("[data-motion-demo] .motion-demo-shape")].filter(
          (shape) => shape.getAnimations().length > 0,
        ).length,
    );
    expect(playing).toBeGreaterThanOrEqual(5);
    expect(await moving.evaluate(() => window.studioChanges.length)).toBe(1);
    await moving.close();

    const still = await openMotionPanel(browser, { width: 288, reducedMotion: "reduce" });
    await still.getByRole("button", { name: "Add motion" }).click();
    await still.getByRole("radio", { name: "Appears" }).click();
    const shapes = await still.evaluate(() =>
      [...document.querySelectorAll("[data-motion-demo] .motion-demo-shape")].map((shape) => ({
        animations: shape.getAnimations().length,
        opacity: getComputedStyle(shape).opacity,
      })),
    );
    expect(shapes.length).toBeGreaterThanOrEqual(5);
    // Still, and resting where the movement ends, so the shape is in view.
    expect(shapes.every((shape) => shape.animations === 0 && shape.opacity === "1")).toBe(true);
    await still.close();
  });
});
