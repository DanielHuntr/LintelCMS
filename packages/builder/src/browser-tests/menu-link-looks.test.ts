import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type DataSite,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { designBaseStylesheet } from "../render/design-stylesheet.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";

/*
 * A Menu's hover looks, in a real browser (LINTEL-UX-078): a thin circle around the link
 * the pointer is over, held on the current page's link; the same on keyboard focus; nothing
 * moving for people who ask for less motion; and the words rolling up.
 */

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

const site: DataSite = {
  siteName: "Studio",
  homeUrl: "/",
  logo: null,
  menu: ["Shop", "Home", "Work", "Studio", "Contact"].map((label) => ({
    id: label.toLowerCase(),
    label,
    url: `/${label.toLowerCase()}`,
    current: label === "Home",
    children: [],
  })),
  socialLinks: [],
  footerText: "",
  languages: [],
  locale: "en-GB",
  apiBase: "/_lintel/api",
};

function menuPage(linkProps: Record<string, unknown>): PageDocument {
  const page = createEmptyPage();
  const menu = createNode(
    {
      type: "navigation",
      styles: { base: { fontFamily: "monospace", textTransform: "uppercase" } },
    },
    standardCatalogue,
    createCountingNodeIds("m"),
  );
  menu.children[0]!.props = { ...menu.children[0]!.props, ...linkProps };
  return { ...page, root: { ...page.root, children: [menu] } };
}

async function open(
  linkProps: Record<string, unknown>,
  reducedMotion: "reduce" | "no-preference" = "no-preference",
): Promise<Page> {
  const { html, css } = renderPage(menuPage(linkProps), standardRegistry, { data: { site } });
  const page = await browser.newPage({ viewport: { width: 900, height: 300 }, reducedMotion });
  await page.setContent(
    `<!doctype html><html lang="en-GB"><head><style>${designBaseStylesheet}
nav ul { display: flex; gap: 40px; list-style: none; padding: 40px; }
a { color: rgb(17, 17, 17); text-decoration: none; }
${css}</style></head><body><div class="lintel-design">${html}</div></body></html>`,
  );
  return page;
}

const circleOf = (page: Page, item: string) =>
  page.$eval(`[data-menu-item="${item}"]`, (link) => {
    const style = getComputedStyle(link, "::before");
    return { opacity: style.opacity, transition: style.transitionDuration };
  });
const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("a menu's hover looks", () => {
  it("holds the circle on the current page's link, and draws it on hover and keyboard focus", async () => {
    const page = await open({ hoverLook: "circle" });
    expect((await circleOf(page, "home")).opacity).toBe("1");
    expect((await circleOf(page, "work")).opacity).toBe("0");
    await page.hover('[data-menu-item="work"]');
    await pause(600);
    expect((await circleOf(page, "work")).opacity).toBe("1");
    await page.mouse.move(0, 280);
    await page.focus('[data-menu-item="contact"]');
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await pause(600);
    expect((await circleOf(page, "contact")).opacity).toBe("1");
    expect((await circleOf(page, "work")).opacity).toBe("0");
    await page.close();
  });

  it("can leave the current page's link plain", async () => {
    const page = await open({ hoverLook: "circle", keepOnCurrent: false });
    expect((await circleOf(page, "home")).opacity).toBe("0");
    await page.close();
  });

  it("changes at once, without moving, for people who ask for less motion", async () => {
    const page = await open({ hoverLook: "circle" }, "reduce");
    expect((await circleOf(page, "work")).transition).toBe("0s");
    await page.hover('[data-menu-item="work"]');
    expect((await circleOf(page, "work")).opacity).toBe("1");
    await page.close();

    const rolls = await open({ hoverLook: "rollUp" }, "reduce");
    await rolls.hover('[data-menu-item="work"]');
    await pause(300);
    expect(
      await rolls.$eval(
        '[data-menu-item="work"] .lintel-roll__words',
        (words) => getComputedStyle(words).transform,
      ),
    ).toBe("none");
    await rolls.close();
  });

  it("rolls the words up on hover, with the copy clipped out of sight until then", async () => {
    const page = await open({ hoverLook: "rollUp" });
    const words = '[data-menu-item="work"] .lintel-roll__words';
    const transformOf = () => page.$eval(words, (element) => getComputedStyle(element).transform);
    expect(await transformOf()).toBe("none");
    const box = (await page.locator('[data-menu-item="work"]').boundingBox())!;
    const copy = (await page.locator('[data-menu-item="work"] .lintel-roll__copy').boundingBox())!;
    // The copy waits below the words, out of the clipped window.
    expect(copy.y).toBeGreaterThanOrEqual(box.y + box.height - 1);
    await page.hover('[data-menu-item="work"]');
    await pause(700);
    expect(await transformOf()).toMatch(/matrix\(1, 0, 0, 1, 0, -\d/);
    await page.close();
  });
});
