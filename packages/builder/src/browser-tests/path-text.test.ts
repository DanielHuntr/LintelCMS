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
import { elementStylesheet } from "../render/elements/element-stylesheet.js";
import { renderPage } from "../render/render-page.js";
import { standardRegistry } from "../render/stand-in-components.js";

/*
 * Text on a path in a real browser (LINTEL-UX-090): the words go all the way round a circle
 * badge and stay inside it, its size follows the text size, it turns slowly unless less
 * motion is asked for, and arcs and waves fit a phone.
 */

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

function pathTextPage(props: Record<string, unknown>, fontSize = "15px"): PageDocument {
  const page = createEmptyPage();
  const node = createNode(
    { type: "pathText", props },
    standardCatalogue,
    createCountingNodeIds("t"),
  );
  node.styles = { base: { ...node.styles.base, fontSize } };
  return { ...page, root: { ...page.root, children: [node] } };
}

async function open(
  props: Record<string, unknown>,
  {
    reducedMotion = "no-preference",
    width = 900,
    fontSize,
  }: { reducedMotion?: "reduce" | "no-preference"; width?: number; fontSize?: string } = {},
): Promise<Page> {
  const { html, css } = renderPage(pathTextPage(props, fontSize), standardRegistry);
  const page = await browser.newPage({ viewport: { width, height: 600 }, reducedMotion });
  await page.setContent(
    `<!doctype html><html lang="en-GB"><head><style>${designBaseStylesheet}
${elementStylesheet}
${css}</style></head><body><div class="lintel-design">${html}</div></body></html>`,
  );
  return page;
}

const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;
const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const rotation = (page: Page) =>
  page.$eval(".lintel-path-text__drawing", (drawing) => getComputedStyle(drawing).rotate);

describe("text on a path", () => {
  it("wraps the words right round a circle badge, inside its box, sized by the text", async () => {
    const page = await open({ text: "Trust your gut · Trust your gut · ", turn: "off" });
    const drawing = await box(page, ".lintel-path-text__drawing");
    expect(drawing.width).toBeCloseTo(150, 0);
    expect(drawing.height).toBeCloseTo(150, 0);
    const words = await box(page, ".lintel-path-text__words");
    // Round the whole circle: the words reach every side of the badge.
    expect(words.width).toBeGreaterThan(drawing.width * 0.85);
    expect(words.height).toBeGreaterThan(drawing.height * 0.85);
    // Centred on the badge (Chromium measures each letter's whole box, so allow a little).
    const centre = (from: number, size: number) => from + size / 2;
    expect(Math.abs(centre(words.x, words.width) - centre(drawing.x, drawing.width))).toBeLessThan(
      8,
    );
    expect(
      Math.abs(centre(words.y, words.height) - centre(drawing.y, drawing.height)),
    ).toBeLessThan(12);
    await page.close();
    const bigger = await open({ turn: "off" }, { fontSize: "30px" });
    expect((await box(bigger, ".lintel-path-text__drawing")).width).toBeCloseTo(300, 0);
    await bigger.close();
  });

  it("turns slowly, and stays still for people who ask for less motion", async () => {
    const page = await open({ turn: "slowly" });
    const first = await rotation(page);
    await pause(400);
    expect(await rotation(page)).not.toBe(first);
    await page.close();
    const still = await open({ turn: "slowly" }, { reducedMotion: "reduce" });
    expect(await rotation(still)).toBe("none");
    await still.close();
  });

  it("keeps a gap where the words meet themselves going round", async () => {
    const page = await open({ text: "Trust your gut", turn: "off" });
    expect(await page.$eval("textPath", (path) => path.textContent)).toBe(
      "Trust your gut\u00a0·\u00a0",
    );
    await page.close();
  });

  it("is read once, as words, by screen readers", async () => {
    const page = await open({ text: "Made by hand", turn: "off" });
    const snapshot = await page.locator("body").ariaSnapshot();
    expect(snapshot.match(/Made by hand/g)).toHaveLength(1);
    await page.close();
  });

  it("shrinks a wave to fit a phone instead of running off the side", async () => {
    const page = await open({ shape: "wave", text: "Fresh bread every morning" }, { width: 390 });
    const drawing = await box(page, ".lintel-path-text__drawing");
    expect(drawing.x + drawing.width).toBeLessThanOrEqual(390);
    await page.close();
  });
});
