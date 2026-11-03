import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cursorWordCss } from "../effects/kit/cursor-look.js";
import { launchBrowser } from "./harness.js";
import {
  openEffectsPage,
  waitFor,
  type EffectOnTest,
  type OpenOptions,
} from "./effects-harness.js";

/**
 * Designing the cursor: the site's own cursor picture and where it points, the word's look,
 * and what the cursor does over one element (grow, a different picture, hide, or the
 * normal pointer). Played by the built site runtime and modules (run `pnpm build` first).
 */

let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

const square = (colour: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${colour}"/></svg>`;
const pictures = { "/arrow.svg": square("#e11"), "/hand.svg": square("#1e1") };
const theme =
  ":root{--lintel-color-text:rgb(10, 20, 30);--lintel-color-background:rgb(250, 250, 250);--lintel-color-brand:rgb(200, 30, 60);--lintel-color-on-brand:rgb(255, 255, 255)}";

const off = {
  pageTransition: { style: "none", duration: 400 },
  cursor: { style: "none", trail: "none", colour: "text", size: 32 },
  intro: { style: "none", text: "", background: "#000000", colour: "#ffffff" },
  smoothScroll: { strength: "off" },
};

function siteWith(cursor: Record<string, unknown>) {
  return { ...off, cursor: { ...off.cursor, ...cursor } };
}

async function open(
  html: string,
  effects: readonly EffectOnTest[],
  site: Record<string, unknown>,
  options: OpenOptions = {},
): Promise<Page> {
  const { page } = await openEffectsPage(browser, html, effects, {
    site,
    css: theme,
    pages: pictures,
    ...options,
  });
  return page;
}

const box = (page: Page, selector: string) =>
  page.$eval(selector, (node) => {
    const { left, top, width, height } = node.getBoundingClientRect();
    return { left: Math.round(left), top: Math.round(top), width, height };
  });

const pictureCursor = (point: "centre" | "top-left") =>
  siteWith({
    style: "picture",
    picture: { assetId: "", src: "/arrow.svg", size: 40, point, bytes: 0 },
  });

describe("the site's own cursor picture", () => {
  it("puts the middle of the picture on the pointer", async () => {
    const page = await open("<p>Hello</p>", [], pictureCursor("centre"));
    await page.mouse.move(10, 10);
    await waitFor(page, () => document.querySelector(".lintel-cursor-picture") !== null);
    await waitFor(
      page,
      () => (document.querySelector(".lintel-cursor-picture") as HTMLImageElement).complete,
    );
    await page.mouse.move(300, 200);
    await waitFor(page, () =>
      (document.querySelector(".lintel-cursor-picture") as HTMLElement).style.translate.includes(
        "300px",
      ),
    );
    expect(await box(page, ".lintel-cursor-picture")).toEqual({
      left: 280,
      top: 180,
      width: 40,
      height: 40,
    });
    // It's decorative, never in the way of a click, and the normal pointer is hidden.
    expect(
      await page.$eval(".lintel-cursor-picture", (node) => ({
        hidden: node.getAttribute("aria-hidden"),
        alt: node.getAttribute("alt"),
        pointerEvents: getComputedStyle(node).pointerEvents,
        nativeCursor: getComputedStyle(document.body).cursor,
      })),
    ).toEqual({ hidden: "true", alt: "", pointerEvents: "none", nativeCursor: "none" });
    expect(await page.$$eval(".lintel-cursor", (nodes) => nodes.length)).toBe(0);
    await page.close();
  });

  it("puts the top-left corner on the pointer, like an arrow, even with less motion", async () => {
    const page = await open("<p>Hello</p>", [], pictureCursor("top-left"), {
      reducedMotion: "reduce",
    });
    await page.mouse.move(10, 10);
    await waitFor(page, () => document.querySelector(".lintel-cursor-picture") !== null);
    await page.mouse.move(300, 200);
    await waitFor(page, () =>
      (document.querySelector(".lintel-cursor-picture") as HTMLElement).style.translate.includes(
        "300px",
      ),
    );
    const { left, top } = await box(page, ".lintel-cursor-picture");
    expect({ left, top }).toEqual({ left: 300, top: 200 });
    await page.close();
  });

  it("keeps the normal pointer when no picture has been chosen", async () => {
    const page = await open(
      "<p>Hello</p>",
      [],
      siteWith({
        style: "picture",
        picture: { assetId: "", src: "", size: 40, point: "centre", bytes: 0 },
      }),
    );
    await page.mouse.move(100, 100);
    await page.waitForTimeout(300);
    expect(await page.$$eval(".lintel-cursor-picture", (nodes) => nodes.length)).toBe(0);
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("lintel-custom-cursor"),
      ),
    ).toBe(false);
    await page.close();
  });

  it("refuses a script address", async () => {
    const page = await open(
      "<p>Hello</p>",
      [],
      siteWith({
        style: "picture",
        picture: { assetId: "", src: "javascript:alert(1)", size: 40, point: "centre", bytes: 0 },
      }),
    );
    await page.mouse.move(100, 100);
    await page.waitForTimeout(300);
    expect(await page.$$eval(".lintel-cursor-picture", (nodes) => nodes.length)).toBe(0);
    await page.close();
  });
});

describe("the cursor's word look", () => {
  const card = `<div data-node-id="card" style="margin-top:200px;height:200px">Project</div>`;
  const wordOn = (params: Record<string, string> = {}): EffectOnTest[] => [
    {
      nodeId: "card",
      module: "cursor",
      behaviour: "cursorWord",
      params: { text: "View", ...params },
    },
  ];
  const label = (page: Page) =>
    page.$eval(".lintel-cursor-label[data-shown]", (node) => {
      const style = getComputedStyle(node);
      const { width, height } = node.getBoundingClientRect();
      return {
        background: style.backgroundColor,
        colour: style.color,
        fontSize: style.fontSize,
        radius: style.borderTopLeftRadius,
        square: Math.abs(width - height) < 1,
      };
    });

  it("wears the site's choice: background, letters that read on it, size and shape", async () => {
    const css =
      theme +
      cursorWordCss({
        background: "var(--lintel-color-brand)",
        colour: "auto",
        size: "large",
        shape: "circle",
      });
    const page = await open(card, wordOn(), siteWith({ style: "ring" }), { css });
    await page.mouse.move(100, 50);
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-word]") !== null);
    await page.mouse.move(100, 300);
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    expect(await label(page)).toEqual({
      background: "rgb(200, 30, 60)",
      colour: "rgb(255, 255, 255)",
      fontSize: "16px",
      radius: "50%",
      square: true,
    });
    await page.close();
  });

  it("lets an element change it, without a site cursor too", async () => {
    const page = await open(
      card,
      wordOn({ background: "#ffdd00", shape: "square", size: "small" }),
      off,
    );
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-word]") !== null);
    await page.mouse.move(100, 300);
    await page.mouse.move(110, 310);
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    expect(await label(page)).toMatchObject({
      background: "rgb(255, 221, 0)",
      // Dark letters on a light yellow.
      colour: "rgb(17, 17, 17)",
      fontSize: "11.2px",
      radius: "6px",
      square: false,
    });
    await page.close();
  });

  it("picks readable letters for one of the site's own colours", async () => {
    const page = await open(
      card,
      wordOn({ background: "var(--site-sand)" }),
      siteWith({ style: "ring" }),
      { css: `${theme}:root{--site-sand:rgb(240, 230, 210)}` },
    );
    await page.mouse.move(100, 50);
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-word]") !== null);
    await page.mouse.move(100, 300);
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    expect(await label(page)).toMatchObject({
      background: "rgb(240, 230, 210)",
      colour: "rgb(17, 17, 17)",
    });
    await page.close();
  });

  it("looks as it always did when nothing is chosen", async () => {
    const page = await open(card, wordOn(), siteWith({ style: "ring-and-dot" }));
    await page.mouse.move(100, 50);
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-word]") !== null);
    await page.mouse.move(100, 300);
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    expect(await label(page)).toEqual({
      background: "rgb(10, 20, 30)",
      colour: "rgb(250, 250, 250)",
      fontSize: "12.8px",
      radius: "999px",
      square: false,
    });
    await page.close();
  });
});

describe("when the pointer is over an element", () => {
  const area = (mode: string, extra: Record<string, string | number> = {}): EffectOnTest[] => [
    { nodeId: "area", module: "cursor", behaviour: "cursorOver", params: { mode, ...extra } },
  ];
  const html = `<div style="height:100px">Above</div><div data-node-id="area" style="height:200px"><p id="words">Some words to select</p><a id="link" href="#">A link</a></div>`;
  const ready = async (page: Page) => {
    await page.mouse.move(100, 30);
    await waitFor(page, () => document.querySelector(".lintel-cursor") !== null);
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-over]") !== null);
  };
  const hiddenParts = (page: Page) =>
    page.$$eval(".lintel-cursor[data-hidden], .lintel-cursor-picture[data-hidden]", (nodes) =>
      nodes.map((node) => node.className).sort(),
    );

  it("grows the cursor", async () => {
    const page = await open(html, area("grow"), siteWith({ style: "ring" }));
    await ready(page);
    await page.mouse.move(300, 200);
    await waitFor(
      page,
      () => (document.querySelector(".lintel-cursor") as HTMLElement).style.width === "57.6px",
    );
    await page.mouse.move(300, 30);
    await waitFor(
      page,
      () => (document.querySelector(".lintel-cursor") as HTMLElement).style.width === "32px",
    );
    await page.close();
  });

  it("grows a dot on its own by scaling it", async () => {
    const page = await open(html, area("grow"), siteWith({ style: "dot" }));
    await ready(page);
    await page.mouse.move(300, 200);
    await waitFor(page, () => document.querySelector(".lintel-cursor[data-grown]") !== null);
    await page.close();
  });

  it("becomes a different picture, with its own point, and back again", async () => {
    const page = await open(
      html,
      area("picture", { src: "/hand.svg", size: 24, point: "top-left" }),
      siteWith({ style: "ring-and-dot" }),
    );
    await ready(page);
    await page.mouse.move(300, 200);
    await waitFor(page, () => document.querySelector(".lintel-cursor-picture") !== null);
    await page.mouse.move(310, 210);
    await waitFor(page, () =>
      (document.querySelector(".lintel-cursor-picture") as HTMLElement).style.translate.includes(
        "310px",
      ),
    );
    expect(await page.$eval(".lintel-cursor-picture", (node) => node.getAttribute("src"))).toBe(
      "/hand.svg",
    );
    const { left, top, width } = await box(page, ".lintel-cursor-picture");
    expect({ left, top, width }).toEqual({ left: 310, top: 210, width: 24 });
    expect(await hiddenParts(page)).toEqual(["lintel-cursor", "lintel-cursor"]);
    await page.mouse.move(300, 30);
    await waitFor(page, () => document.querySelector(".lintel-cursor[data-hidden]") === null);
    expect(await hiddenParts(page)).toEqual(["lintel-cursor-picture"]);
    await page.close();
  });

  it("swaps the site's own picture for the element's", async () => {
    const page = await open(
      html,
      area("picture", { src: "/hand.svg", size: 24 }),
      pictureCursor("centre"),
    );
    await page.mouse.move(100, 30);
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-over]") !== null);
    await page.mouse.move(300, 200);
    await waitFor(
      page,
      () => document.querySelector(".lintel-cursor-picture")?.getAttribute("src") === "/hand.svg",
    );
    await page.mouse.move(300, 30);
    await waitFor(
      page,
      () => document.querySelector(".lintel-cursor-picture")?.getAttribute("src") === "/arrow.svg",
    );
    await page.close();
  });

  it("hides the custom cursor, and the pointer with it", async () => {
    const page = await open(html, area("hide"), siteWith({ style: "ring-and-dot" }));
    await ready(page);
    await page.mouse.move(300, 200);
    await waitFor(
      page,
      () => document.querySelectorAll(".lintel-cursor[data-hidden]").length === 2,
    );
    expect(await page.$eval("#words", (node) => getComputedStyle(node).cursor)).toBe("none");
    await page.close();
  });

  it("gives way to the normal pointer, for text people select and links", async () => {
    const page = await open(html, area("normal"), siteWith({ style: "ring-and-dot" }));
    await ready(page);
    await page.mouse.move(300, 200);
    await waitFor(
      page,
      () => document.querySelectorAll(".lintel-cursor[data-hidden]").length === 2,
    );
    const cursors = await page.evaluate(() => ({
      words: getComputedStyle(document.getElementById("words")!).cursor,
      link: getComputedStyle(document.getElementById("link")!).cursor,
      outside: getComputedStyle(document.body).cursor,
    }));
    expect(cursors).toEqual({ words: "auto", link: "pointer", outside: "none" });
    await page.close();
  });

  it("shows a different picture as the browser's own cursor when the site has none", async () => {
    const page = await open(html, area("picture", { src: "/hand.svg", size: 40 }), off);
    await waitFor(page, () =>
      getComputedStyle(document.querySelector("[data-node-id=area]")!).cursor.includes("hand.svg"),
    );
    const cursor = await page.$eval("[data-node-id=area]", (node) => getComputedStyle(node).cursor);
    // Its middle is the point: 20 across and 20 down on a 40 pixel square.
    expect(cursor).toMatch(/url\(".*\/hand\.svg"\) 20 20, auto/);
    await page.close();
  });

  it("hides the pointer when the site has no custom cursor", async () => {
    const page = await open(html, area("hide"), off);
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-over]") !== null);
    expect(await page.$eval("#words", (node) => getComputedStyle(node).cursor)).toBe("none");
    await page.close();
  });

  it("does nothing on touch screens", async () => {
    const context = await browser.newContext({ hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (query: string) =>
        query === "(pointer: fine)"
          ? ({ ...original(query), matches: false } as MediaQueryList)
          : original(query);
    });
    const { effectsDocument } = await import("./effects-harness.js");
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const dist = fileURLToPath(new URL("../../dist/", import.meta.url));
    const pageHtml = effectsDocument(html, area("hide"), { site: pictureCursor("centre") });
    await page.route("http://touch.test/**", (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/_lintel/motion.js") {
        return route.fulfill({
          contentType: "text/javascript",
          body: readFileSync(`${dist}site-runtime.js`, "utf8"),
        });
      }
      if (path.startsWith("/_lintel/effects/")) {
        return route.fulfill({
          contentType: "text/javascript",
          body: readFileSync(`${dist}effect-modules/${path.split("/").pop()}`, "utf8"),
        });
      }
      return route.fulfill({ contentType: "text/html", body: pageHtml });
    });
    await page.goto("http://touch.test/");
    await page.waitForTimeout(400);
    expect(
      await page.evaluate(() => ({
        over: document.querySelectorAll("[data-lintel-cursor-over]").length,
        picture: document.querySelectorAll(".lintel-cursor-picture").length,
      })),
    ).toEqual({ over: 0, picture: 0 });
    await context.close();
  });
});

describe("over an embedded video", () => {
  it("hides the cursor picture over the frame and brings it back after", async () => {
    const page = await open(
      `<div style="height:100px">Above</div><iframe id="video" srcdoc="<p>Video</p>" style="display:block;width:400px;height:200px;border:0"></iframe>`,
      [],
      pictureCursor("centre"),
    );
    await page.mouse.move(100, 30);
    await waitFor(page, () => document.querySelector(".lintel-cursor-picture") !== null);
    await page.mouse.move(110, 40);
    await waitFor(
      page,
      () => (document.querySelector(".lintel-cursor-picture") as HTMLElement).style.opacity === "1",
    );
    await page.mouse.move(200, 200);
    await waitFor(
      page,
      () => (document.querySelector(".lintel-cursor-picture") as HTMLElement).style.opacity === "0",
    );
    await page.mouse.move(100, 30);
    await waitFor(
      page,
      () => (document.querySelector(".lintel-cursor-picture") as HTMLElement).style.opacity === "1",
    );
    await page.close();
  });
});
