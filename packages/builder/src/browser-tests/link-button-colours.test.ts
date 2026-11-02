import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { standInBaseStylesheet } from "../render/base-stylesheet.js";
import { designBaseStylesheet } from "../render/design-stylesheet.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";

/*
 * A link styled as a button (the basket's "Check out", the Checkout button, the Header's
 * button) must keep the button's text colour. The site's own "a { color: link }" rule used to
 * outweigh the button's zero-specificity style, so "Check out" was brand text on a brand
 * button (LINTEL-LEFT-001 in docs/qa/FIX-LOG-leftovers.md).
 */

const onBrand = "rgb(255, 255, 255)";
const linkColour = "rgb(117, 57, 253)";
const textColour = "rgb(17, 17, 17)";

/* The website's stylesheet starts with the site's own rules; this stands in for them. */
const siteRules = `:root { --lintel-color-brand: ${linkColour}; --lintel-color-link: ${linkColour};
  --lintel-color-on-brand: ${onBrand}; --lintel-color-text: ${textColour}; }
a { color: var(--lintel-color-link); }`;

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

function linkButtonsPage(): PageDocument {
  const page = createEmptyPage();
  const ids = createCountingNodeIds("links");
  const section = createNode(
    {
      type: "section",
      children: [
        { type: "siteHeader", props: { buttonLabel: "Book a call", buttonHref: "/contact" } },
        { type: "cartDrawer" },
        { type: "checkoutButton" },
      ],
    },
    standardCatalogue,
    ids,
  );
  return { ...page, root: { ...page.root, children: [section] } };
}

async function open(baseStylesheet: string): Promise<Page> {
  const design = renderPage(linkButtonsPage(), standardRegistry);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(
    `<!doctype html><html lang="en-GB"><head><style>${siteRules}\n${baseStylesheet}\n${designBaseStylesheet}\n${design.css}
.chosen-in-style-panel { color: rgb(0, 128, 0); }</style></head>
<body><div class="lintel-design">${design.html}
<nav><a class="lintel-button" id="in-menu" href="/">In a menu</a>
<a class="lintel-button lintel-button--secondary" id="secondary" href="/">Secondary</a></nav>
<a class="lintel-button chosen-in-style-panel" id="styled" href="/">Styled</a></div></body></html>`,
  );
  return page;
}

const colourOf = (page: Page, selector: string) =>
  page.$eval(selector, (element) => getComputedStyle(element).color);

describe("links styled as buttons", () => {
  for (const [name, baseStylesheet] of [
    ["on the website", ""],
    ["on the canvas, with the stand-in base styles", standInBaseStylesheet],
  ] as const) {
    it(`keep the button's text colour ${name}`, async () => {
      const page = await open(baseStylesheet);
      expect(await colourOf(page, ".lintel-cart__checkout")).toBe(onBrand);
      expect(await colourOf(page, ".lintel-checkout-button")).toBe(onBrand);
      expect(await colourOf(page, ".lintel-site-header__button")).toBe(onBrand);
      expect(await colourOf(page, "#in-menu")).toBe(onBrand);
      expect(await colourOf(page, "#secondary")).toBe(textColour);
      // A colour chosen in the style panel (a class) still wins.
      expect(await colourOf(page, "#styled")).toBe("rgb(0, 128, 0)");
      // Plain links keep the link colour.
      expect(await colourOf(page, ".lintel-site-header__brand")).not.toBe(onBrand);
      await page.close();
    });
  }
});
