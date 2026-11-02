import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { designBaseStylesheet } from "../render/design-stylesheet.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";

/*
 * The Header shows its menu links on wide screens and a "Menu" button on small ones, never
 * both. The button also has .lintel-drawer__open, whose display:inline-flex used to come
 * later in the stylesheet and win at every width (LINTEL-LEFT-004).
 */

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

const menuItem = (label: string, href: string) => ({
  label,
  href,
  columnOneTitle: "",
  columnOneLinks: [],
  columnTwoTitle: "",
  columnTwoLinks: [],
  columnThreeTitle: "",
  columnThreeLinks: [],
  featuredImage: { src: "", alt: "", assetId: null },
  featuredTitle: "",
  featuredHref: "",
});

function headerPage(): PageDocument {
  const page = createEmptyPage();
  const header = createNode(
    {
      type: "siteHeader",
      props: {
        menuSource: "custom",
        items: [menuItem("About", "/about"), menuItem("Contact", "/contact")],
      },
    },
    standardCatalogue,
    createCountingNodeIds("header"),
  );
  return { ...page, root: { ...page.root, children: [header] } };
}

describe("the builder's Header", () => {
  for (const [width, menuShows] of [
    [1440, true],
    [992, true],
    [991, false],
    [390, false],
  ] as const) {
    it(`shows ${menuShows ? "its menu links" : "only the Menu button"} at ${width}px`, async () => {
      const design = renderPage(headerPage(), standardRegistry);
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      await page.setContent(
        `<!doctype html><html lang="en-GB"><head><style>${designBaseStylesheet}\n${design.css}</style></head><body>${design.html}</body></html>`,
      );
      const visible = await page.evaluate(() => ({
        links: document.querySelector(".lintel-site-header__nav")?.checkVisibility() ?? false,
        menuButton:
          document.querySelector(".lintel-site-header__menu-button")?.checkVisibility() ?? false,
      }));
      expect(visible).toEqual({ links: menuShows, menuButton: !menuShows });
      await page.close();
    });
  }
});
