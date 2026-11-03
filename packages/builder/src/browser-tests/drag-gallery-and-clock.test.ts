import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { designBaseStylesheet } from "../render/design-stylesheet.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";

/*
 * The Slider dragged freely (momentum, a soft stop at the ends, arrow keys) and the live
 * clock, drawn by the real renderer and run by the real elements script (build first).
 */

const here = dirname(fileURLToPath(import.meta.url));
const behaviours = join(here, "../../dist/site-behaviours.js");
const origin = "https://studio.test";

function pageOf(...blueprints: NodeBlueprint[]): PageDocument {
  const createId = createCountingNodeIds("e");
  const empty = createEmptyPage();
  return {
    ...empty,
    root: {
      ...empty.root,
      children: blueprints.map((blueprint) => createNode(blueprint, standardCatalogue, createId)),
    },
  };
}

const slide = (words: string): NodeBlueprint => ({
  type: "slide",
  children: [{ type: "heading", props: { text: words, level: 3 } }],
});

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

async function open(
  document: PageDocument,
  reducedMotion: "reduce" | "no-preference" = "no-preference",
) {
  const rendered = renderPage(document, standardRegistry, { mode: "site" });
  const html = `<!doctype html><html lang="en-GB"><head><style>${designBaseStylesheet}${rendered.css}
:root{--lintel-space-3:0.75rem;--lintel-space-4:1rem} body{margin:0} .lintel-carousel{width:800px}</style></head><body>${rendered.html}
<script src="/site-behaviours.js" defer></script></body></html>`;
  const tab = await browser.newPage({ viewport: { width: 1000, height: 700 }, reducedMotion });
  await tab.route(`${origin}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/site-behaviours.js") {
      return route.fulfill({ contentType: "text/javascript", body: readFileSync(behaviours) });
    }
    return route.fulfill({ contentType: "text/html", body: html });
  });
  await tab.goto(`${origin}/`);
  await tab.waitForTimeout(100);
  return tab;
}

const gallery = () =>
  pageOf({
    type: "carousel",
    props: { freeDrag: true, perView: 3, showDots: false },
    children: ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"].map(slide),
  });

const scrollLeft = (tab: Page) => tab.$eval(".lintel-carousel__track", (track) => track.scrollLeft);

async function drag(tab: Page, from: number, to: number, steps = 8) {
  const box = await tab.$eval(".lintel-carousel__track", (track) => {
    const rect = track.getBoundingClientRect();
    return { y: rect.top + rect.height / 2, left: rect.left };
  });
  await tab.mouse.move(box.left + from, box.y);
  await tab.mouse.down();
  await tab.mouse.move(box.left + to, box.y, { steps });
  return box;
}

describe("the Slider dragged freely", () => {
  it("follows a mouse drag, then glides on and slows to a stop", async () => {
    const tab = await open(gallery());
    await drag(tab, 600, 300, 4);
    const atRelease = await scrollLeft(tab);
    expect(atRelease).toBeGreaterThan(250);
    await tab.mouse.up();
    await tab.waitForTimeout(80);
    const gliding = await scrollLeft(tab);
    expect(gliding).toBeGreaterThan(atRelease);
    await tab.waitForTimeout(1500);
    const settled = await scrollLeft(tab);
    await tab.waitForTimeout(200);
    expect(await scrollLeft(tab)).toBe(settled);
    await tab.close();
  });

  it("gives a little when pulled past the start, then springs back", async () => {
    const tab = await open(gallery());
    await drag(tab, 100, 500);
    const offset = await tab.$eval(".lintel-carousel__track", (track) =>
      parseFloat(track.style.getPropertyValue("--lintel-drag-offset")),
    );
    expect(offset).toBeGreaterThan(10);
    expect(offset).toBeLessThan(800 * 0.15 + 1);
    expect(await scrollLeft(tab)).toBe(0);
    await tab.mouse.up();
    await tab.waitForTimeout(600);
    expect(
      await tab.$eval(".lintel-carousel__track", (track) =>
        track.style.getPropertyValue("--lintel-drag-offset"),
      ),
    ).toBe("0.00px");
    await tab.close();
  });

  it("still moves with the arrow keys, and doesn't snap", async () => {
    const tab = await open(gallery());
    expect(
      await tab.$eval(".lintel-carousel__track", (track) => getComputedStyle(track).scrollSnapType),
    ).toBe("none");
    await tab.focus(".lintel-carousel__track");
    await tab.keyboard.press("ArrowRight");
    await tab.waitForTimeout(700);
    expect(await scrollLeft(tab)).toBeGreaterThan(100);
    await tab.close();
  });

  it("doesn't count a drag as a click on a link inside it", async () => {
    const document = pageOf({
      type: "carousel",
      props: { freeDrag: true, perView: 3, showDots: false },
      children: [1, 2, 3, 4, 5].map(() => ({
        type: "slide",
        children: [{ type: "link", props: { text: "Project", href: "#opened" } }],
      })),
    });
    const tab = await open(document);
    const link = await tab.$eval(".lintel-carousel__slide a", (anchor) => {
      const rect = anchor.getBoundingClientRect();
      return { x: rect.left + 5, y: rect.top + rect.height / 2 };
    });
    await tab.mouse.move(link.x, link.y);
    await tab.mouse.down();
    await tab.mouse.move(link.x - 200, link.y, { steps: 5 });
    await tab.mouse.up();
    await tab.waitForTimeout(100);
    expect(await tab.evaluate(() => location.hash)).toBe("");
    await tab.keyboard.press("Tab");
    await tab.close();
  });

  it("stops where it's let go for people who ask for less motion", async () => {
    const tab = await open(gallery(), "reduce");
    await drag(tab, 600, 300, 4);
    await tab.mouse.up();
    const atRelease = await scrollLeft(tab);
    await tab.waitForTimeout(200);
    expect(await scrollLeft(tab)).toBe(atRelease);
    await tab.close();
  });
});

describe("the live clock", () => {
  it("shows the time in the chosen place, in the page's language", async () => {
    const tab = await open(pageOf({ type: "clock", props: { zone: "Asia/Tokyo", hours: "24" } }));
    await tab.waitForFunction(
      () => document.querySelector(".lintel-clock__time")?.textContent !== "--:--",
    );
    const shown = await tab.$eval(".lintel-clock", (clock) => ({
      place: clock.querySelector(".lintel-clock__place")?.textContent,
      time: clock.querySelector(".lintel-clock__time")?.textContent,
    }));
    const expected = await tab.evaluate(() =>
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Tokyo",
      }).format(new Date()),
    );
    expect(shown).toEqual({ place: "Tokyo", time: expected });
    await tab.close();
  });
});
