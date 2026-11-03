import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/*
 * When the browser scrolls to a field (a mistake in a form, say), the sticky site header
 * mustn't cover it (LINTEL-A11Y-006 in docs/qa/BUG-REPORT.md). Uses the site's own header
 * styles and the real elements script.
 */

const here = dirname(fileURLToPath(import.meta.url));
const behaviours = join(here, "../../dist/site-behaviours.js");
const headerCss = join(here, "../../../site-components/src/styles/header.css");
const origin = "https://bakery.test";

function page(withScript: boolean) {
  return `<!doctype html><html lang="en-GB"><head><style>
${readFileSync(headerCss, "utf8")}
body { margin: 0; } .lintel-header { height: 113px; }
</style></head><body>
<header class="lintel-header">Sam's Bakery</header>
<main><div style="height: 1500px">Basket</div>
<form><label id="postcode">Postcode <input name="postalCode" required></label><button>Choose delivery</button></form>
<div style="height: 1500px"></div></main>
${withScript ? `<script src="/site-behaviours.js" defer></script>` : ""}
</body></html>`;
}

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

describe("the sticky site header", () => {
  for (const withScript of [true, false]) {
    it(`leaves a field the browser scrolls to in view${withScript ? "" : ", without the elements script"}`, async () => {
      const tab = await browser.newPage({ viewport: { width: 390, height: 700 } });
      await tab.route(`${origin}/**`, (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/site-behaviours.js") {
          return route.fulfill({ contentType: "text/javascript", body: readFileSync(behaviours) });
        }
        return route.fulfill({ contentType: "text/html", body: page(withScript) });
      });
      await tab.goto(`${origin}/`);
      await tab.waitForTimeout(200);

      const positions = () =>
        tab.evaluate(() => ({
          fieldTop: document.querySelector("label")!.getBoundingClientRect().top,
          headerBottom: document.querySelector("header")!.getBoundingClientRect().bottom,
        }));

      // A form with a mistake, sent from further down: the browser scrolls up to the field.
      await tab.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await tab.evaluate(() => document.querySelector("form")?.requestSubmit());
      await tab.waitForTimeout(300);
      const afterMistake = await positions();
      expect(afterMistake.fieldTop).toBeGreaterThanOrEqual(afterMistake.headerBottom);

      // A link to the field: the browser puts it at the top of the window.
      await tab.evaluate(() => window.scrollTo(0, 0));
      await tab.evaluate(() => (location.hash = "#postcode"));
      await tab.waitForTimeout(300);
      const afterLink = await positions();
      expect(afterLink.fieldTop).toBeGreaterThanOrEqual(afterLink.headerBottom);
      await tab.close();
    });
  }
});
