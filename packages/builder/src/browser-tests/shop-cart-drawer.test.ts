import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { designBaseStylesheet } from "../render/design-stylesheet.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";

/*
 * The basket drawer is a <dialog>. Closed, it must take no room and no keyboard focus, so it
 * can't cover the page or block Add to basket; the basket page, which shares its class,
 * keeps its own layout (LINTEL-FUNC-001 in docs/qa/BUG-REPORT.md).
 */

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

function shopPage(): PageDocument {
  const page = createEmptyPage();
  const ids = createCountingNodeIds("shop");
  const section = createNode(
    {
      type: "section",
      children: [
        { type: "button", props: { label: "Before the basket" } },
        { type: "cartDrawer" },
        { type: "cartContents" },
        { type: "button", props: { label: "After the basket" } },
      ],
    },
    standardCatalogue,
    ids,
  );
  return { ...page, root: { ...page.root, children: [section] } };
}

async function open(width: number): Promise<Page> {
  const design = renderPage(shopPage(), standardRegistry);
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.setContent(
    `<!doctype html><html lang="en-GB"><head><style>${designBaseStylesheet}\n${design.css}</style></head><body>${design.html}</body></html>`,
  );
  return page;
}

describe("the basket drawer on the website", () => {
  for (const width of [1440, 390]) {
    it(`takes no room and no focus while closed, at ${width}px`, async () => {
      const page = await open(width);
      const closed = await page.$eval("dialog.lintel-cart", (dialog) => {
        const box = dialog.getBoundingClientRect();
        return { display: getComputedStyle(dialog).display, width: box.width };
      });
      expect(closed).toEqual({ display: "none", width: 0 });

      const focused: string[] = [];
      for (let stop = 0; stop < 8; stop += 1) {
        await page.keyboard.press("Tab");
        focused.push(
          await page.evaluate(() =>
            document.activeElement?.closest("dialog") ? "drawer" : "page",
          ),
        );
      }
      expect(focused).not.toContain("drawer");

      // The basket page shares the class and keeps its column layout.
      expect(await page.$eval(".lintel-cart--page", (view) => getComputedStyle(view).display)).toBe(
        "flex",
      );

      // The delivery choices the basket script adds stay hidden until there are rates.
      const ratesWhileHidden = await page.$eval(".lintel-cart--page", (view) => {
        const rates = document.createElement("fieldset");
        rates.className = "lintel-cart__rates";
        rates.hidden = true;
        view.append(rates);
        return getComputedStyle(rates).display;
      });
      expect(ratesWhileHidden).toBe("none");

      await page.$eval("dialog.lintel-cart", (dialog) => (dialog as HTMLDialogElement).showModal());
      expect(
        await page.$eval("dialog.lintel-cart", (dialog) => getComputedStyle(dialog).display),
      ).toBe("flex");
      await page.close();
    });
  }
});
