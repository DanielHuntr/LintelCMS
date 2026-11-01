import type { MotionSpec } from "@lintel/motion";
import type { Browser, Locator, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser, openStudio } from "./harness.js";

// Undefined only if Chromium failed to start, which beforeAll reports.
let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

const lastSpec = (page: Page): Promise<MotionSpec | undefined> =>
  page.evaluate(() => window.studioChanges.at(-1));

async function centreOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element is not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

/** The lane a keyframe sits in: the keyframe's parent. */
const laneOf = (keyframe: Locator) => keyframe.locator("xpath=..");

describe("the timeline with a real pointer", () => {
  it("drags a keyframe along its track, and undo puts it back", async () => {
    const page = await openStudio(browser, "fade-up");
    const keyframe = page.getByRole("button", { name: /Keyframe 2 of 2 on Fade/ });
    const lane = await laneOf(keyframe).boundingBox();
    if (!lane) throw new Error("Track is not on screen");
    const start = await centreOf(keyframe);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(lane.x + lane.width * 0.5, start.y, { steps: 6 });
    await page.mouse.up();

    const moved = (await lastSpec(page))?.tracks[0]?.keyframes[1]?.offset ?? 0;
    expect(moved).toBeGreaterThan(0.45);
    expect(moved).toBeLessThan(0.55);

    // The drag is one step in the history, however many moves it took.
    await page.keyboard.press("ControlOrMeta+z");
    expect((await lastSpec(page))?.tracks[0]?.keyframes[1]?.offset).toBe(1);
    await page.close();
  });

  it("scrubs the preview by dragging along the ruler", async () => {
    const page = await openStudio(browser, "fade-in");
    const playhead = page.getByRole("slider", { name: "Playhead" });
    const ruler = await laneOf(playhead).boundingBox();
    if (!ruler) throw new Error("Ruler is not on screen");
    const duration = Number(await playhead.getAttribute("aria-valuemax"));

    await page.mouse.move(ruler.x + 2, ruler.y + ruler.height / 2);
    await page.mouse.down();
    await page.mouse.move(ruler.x + ruler.width * 0.5, ruler.y + ruler.height / 2, { steps: 5 });
    await page.mouse.up();

    const time = Number(await playhead.getAttribute("aria-valuenow"));
    expect(time / duration).toBeGreaterThan(0.4);
    expect(time / duration).toBeLessThan(0.6);

    // Fade in, part way through: the sample is neither hidden nor fully shown.
    const opacity = Number(
      await page
        .getByRole("region", { name: "Preview" })
        .locator("[aria-hidden] > *")
        .first()
        .evaluate((element) => getComputedStyle(element).opacity),
    );
    expect(opacity).toBeGreaterThan(0.05);
    expect(opacity).toBeLessThan(0.95);
    await page.close();
  });

  it("double-clicking an empty part of a track adds a keyframe there", async () => {
    const page = await openStudio(browser, "fade-up");
    const lane = await laneOf(
      page.getByRole("button", { name: /Keyframe 1 of 2 on Fade/ }),
    ).boundingBox();
    if (!lane) throw new Error("Track is not on screen");

    await page.mouse.dblclick(lane.x + lane.width * 0.25, lane.y + lane.height / 2);

    const keyframes = (await lastSpec(page))?.tracks[0]?.keyframes ?? [];
    expect(keyframes).toHaveLength(3);
    expect(keyframes[1]?.offset).toBeGreaterThan(0.2);
    expect(keyframes[1]?.offset).toBeLessThan(0.3);
    await expect
      .poll(() => page.getByRole("button", { name: /Keyframe 2 of 3 on Fade/ }).count())
      .toBe(1);
    await page.close();
  });
});
