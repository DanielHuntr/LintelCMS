import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/*
 * Keyboard focus around the basket drawer, with the real elements script and a stand-in
 * shop API (LINTEL-A11Y-001 in docs/qa/BUG-REPORT.md).
 */

const origin = "https://bakery.test";
const behaviours = join(dirname(fileURLToPath(import.meta.url)), "../../dist/site-behaviours.js");
const money = { amount: 450, currency: "GBP", formatted: "£4.50" };
const cart = {
  email: null,
  country: null,
  shippingAddress: null,
  shippingRateId: null,
  discountCodes: [],
  lines: [],
  itemCount: 1,
  subtotal: money,
  discounts: [],
  discountProblems: [],
  shipping: null,
  total: money,
};

const page = `<!doctype html><html lang="en-GB"><body>
<form data-behaviour="add-to-cart" data-opens-cart>
  <input type="hidden" name="variantId" value="v1">
  <button type="submit">Add to basket</button>
  <p class="lintel-add-to-cart__status" role="status"></p>
</form>
<dialog data-cart-drawer class="lintel-cart"><p>Your basket</p><button>Close</button></dialog>
<script src="/site-behaviours.js" defer></script>
</body></html>`;

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

describe("the basket drawer and keyboard focus", () => {
  it("puts focus back on Add to basket when the drawer is closed with Escape", async () => {
    const tab = await browser.newPage();
    await tab.route(`${origin}/**`, async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: page });
      if (url.pathname === "/site-behaviours.js") {
        return route.fulfill({ contentType: "text/javascript", body: readFileSync(behaviours) });
      }
      // Answer a moment later, as a real shop does: the button is busy meanwhile.
      await new Promise((resolve) => setTimeout(resolve, 150));
      const body = url.pathname.endsWith("/carts") ? { token: "t1" } : cart;
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
    });
    await tab.goto(`${origin}/`);

    await tab.getByRole("button", { name: "Add to basket" }).focus();
    await tab.keyboard.press("Enter");
    await tab.waitForSelector("dialog[data-cart-drawer][open]");
    await tab.keyboard.press("Escape");

    await expect
      .poll(() =>
        tab.evaluate(() => {
          const focused = document.activeElement;
          return `${focused?.tagName}: ${focused?.tagName === "BODY" ? "" : focused?.textContent?.trim()}`;
        }),
      )
      .toBe("BUTTON: Add to basket");
    await tab.close();
  });
});
