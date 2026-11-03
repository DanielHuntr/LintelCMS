import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/* Open states with the real elements script: the card's button opens and closes it. */

const behaviours = join(dirname(fileURLToPath(import.meta.url)), "../../dist/site-behaviours.js");
const origin = "https://bakery.test";
const page = `<!doctype html><html lang="en-GB"><body>
<article class="card" data-lintel-opens><h3>Sourdough</h3><button type="button">More</button><p class="more">Baked from 5am.</p></article>
<script src="/site-behaviours.js" defer></script></body></html>`;

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

describe("open states", () => {
  it("opens with the card's button, says so, and closes with Escape", async () => {
    const tab = await browser.newPage();
    await tab.route(`${origin}/**`, (route) => {
      const url = new URL(route.request().url());
      return url.pathname === "/site-behaviours.js"
        ? route.fulfill({ contentType: "text/javascript", body: readFileSync(behaviours) })
        : route.fulfill({ contentType: "text/html", body: page });
    });
    await tab.goto(`${origin}/`);
    const button = tab.getByRole("button", { name: "More" });
    await expect.poll(() => button.getAttribute("aria-expanded")).toBe("false");

    await button.click();
    expect(await tab.locator(".card").getAttribute("data-open")).toBe("");
    expect(await button.getAttribute("aria-expanded")).toBe("true");

    await tab.keyboard.press("Escape");
    expect(await tab.locator(".card").getAttribute("data-open")).toBeNull();
    expect(await button.getAttribute("aria-expanded")).toBe("false");
    expect(await tab.evaluate(() => document.activeElement?.textContent)).toBe("More");
    await tab.close();
  });
});
