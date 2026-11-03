import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openEffectsPage, waitFor } from "./effects-harness.js";

/**
 * The creative pack: the 3D model element and the curved and 3D layouts, run by the real
 * site runtime and modules. WebGL comes from SwiftShader, Chromium's software renderer, so
 * the model draws even on machines without a graphics card.
 */

let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
});

afterAll(async () => {
  await browser?.close();
});

const poster = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="tan"/></svg>')}`;

const model = () =>
  `<figure data-node-id="m" role="img" aria-label="A ceramic vase" style="position:relative;width:400px;height:400px;margin:0"><img class="lintel-model__poster" src="${poster}" alt="" style="width:100%;height:100%"></figure>`;

const modelEffect = (params: Record<string, string> = {}) => ({
  nodeId: "m",
  module: "model",
  behaviour: "modelViewer",
  params: { src: "/sample-models/vase.glb", motion: "spin", light: "studio", ...params },
});

/** How many different colours the model's box shows on screen: one for a blank box. */
const coloursShown = async (page: Page) => {
  const picture = (await page.locator("[data-node-id=m]").screenshot()).toString("base64");
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0, 64, 64);
    const pixels = context.getImageData(0, 0, 64, 64).data;
    const colours = new Set<string>();
    for (let at = 0; at < pixels.length; at += 4) {
      colours.add(`${pixels[at]! >> 4},${pixels[at + 1]! >> 4},${pixels[at + 2]! >> 4}`);
    }
    return colours.size;
  }, picture);
};

describe("the 3D model element", () => {
  it("loads three.js and the model only when it comes near the screen, then draws it", async () => {
    const { page, requested } = await openEffectsPage(
      browser,
      `<div style="height:3000px"></div>${model()}`,
      [modelEffect()],
    );
    await page.waitForTimeout(400);
    expect(requested.some((path) => path.endsWith("vase.glb"))).toBe(false);
    await page.evaluate(() => window.scrollTo(0, 2800));
    await waitFor(page, () => document.querySelector("[data-model-ready]") !== null, 15_000);
    expect(requested.filter((path) => path.endsWith("vase.glb"))).toHaveLength(1);
    expect(
      await page.$eval(".lintel-model__canvas", (canvas) => canvas.getAttribute("aria-hidden")),
    ).toBe("true");
    await page.waitForTimeout(700);
    expect(await coloursShown(page)).toBeGreaterThan(20);
    // The element still says what it shows, for screen readers.
    expect(await page.getAttribute("[data-node-id=m]", "aria-label")).toBe("A ceramic vase");
    await page.close();
  });

  it("keeps the poster where WebGL isn't available", async () => {
    const { page, requested } = await openEffectsPage(browser, model(), [modelEffect()], {
      withoutWebGL: true,
    });
    await waitFor(page, () => document.querySelector("[data-model-failed]") !== null, 15_000);
    expect(await page.$(".lintel-model__canvas")).toBeNull();
    expect(await page.isVisible(".lintel-model__poster")).toBe(true);
    expect(requested.some((path) => path.endsWith("vase.glb"))).toBe(false);
    await page.close();
  });

  it("shows only the poster to people who ask for less motion", async () => {
    const { page, requested } = await openEffectsPage(browser, model(), [modelEffect()], {
      reducedMotion: "reduce",
    });
    await page.waitForTimeout(800);
    expect(requested.some((path) => path.startsWith("/_lintel/effects/model-"))).toBe(true);
    expect(requested.some((path) => path.endsWith("vase.glb"))).toBe(false);
    expect(await page.$(".lintel-model__canvas")).toBeNull();
    await page.close();
  });

  it("keeps the poster for a file it can't read", async () => {
    const { page } = await openEffectsPage(browser, model(), [
      modelEffect({ src: "/sample-models/missing.glb" }),
    ]);
    await waitFor(page, () => document.querySelector("[data-model-failed]") !== null, 15_000);
    expect(await page.isVisible(".lintel-model__poster")).toBe(true);
    await page.close();
  });

  it("turns with the arrow keys when it is dragged to turn", async () => {
    const { page } = await openEffectsPage(browser, model(), [modelEffect({ motion: "drag" })]);
    await waitFor(page, () => document.querySelector("[data-model-ready]") !== null, 15_000);
    expect(await page.getAttribute("[data-node-id=m]", "tabindex")).toBe("0");
    await page.waitForTimeout(700);
    const before = await page.locator("[data-node-id=m]").screenshot();
    await page.focus("[data-node-id=m]");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(900);
    const after = await page.locator("[data-node-id=m]").screenshot();
    expect(after.equals(before)).toBe(false);
    await page.close();
  });
});

const pictures = (count: number) =>
  Array.from(
    { length: count },
    (_, index) =>
      `<a href="#p${index}" style="display:block;width:160px;height:110px;background:hsl(${index * 40} 50% 60%)">Picture ${index}</a>`,
  ).join("");

describe("the arc carousel", () => {
  it("bends the row into a curve, keeps reading order and steps with the arrow keys", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div data-node-id="arc" style="height:300px">${pictures(8)}</div>`,
      [{ nodeId: "arc", module: "depth", behaviour: "arcCarousel", params: { speed: 0 } }],
    );
    await waitFor(
      page,
      () =>
        document.querySelector("[data-node-id=arc]")!.getAttribute("aria-roledescription") ===
        "carousel",
    );
    await waitFor(
      page,
      () => (document.querySelector("[data-node-id=arc] a") as HTMLElement).style.transform !== "",
    );
    const middle = () =>
      page.$$eval("[data-node-id=arc] a", (links) =>
        links.findIndex((link) =>
          (link as HTMLElement).style.transform.includes("translate3d(0px"),
        ),
      );
    expect(await middle()).toBe(0);
    // The ones either side have gone back and turned.
    const side = await page.$eval(
      "[data-node-id=arc] a:nth-child(2)",
      (link) => (link as HTMLElement).style.transform,
    );
    expect(side).toMatch(/translate3d\([\d.]+px, 0px, -[\d.]+px\) rotateY\([\d.]+deg\)/);
    expect(
      await page.$$eval("[data-node-id=arc] a", (links) => links.map((link) => link.textContent)),
    ).toEqual(Array.from({ length: 8 }, (_, index) => `Picture ${index}`));
    await page.focus("[data-node-id=arc]");
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(800);
    expect(await middle()).toBe(1);
    await page.close();
  });

  it("drifts by itself, and is a flat swipeable row with less motion", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div data-node-id="arc" style="height:300px">${pictures(6)}</div>`,
      [{ nodeId: "arc", module: "depth", behaviour: "arcCarousel", params: { speed: 1 } }],
    );
    await waitFor(
      page,
      () => (document.querySelector("[data-node-id=arc] a") as HTMLElement).style.transform !== "",
    );
    const first = await page.$eval(
      "[data-node-id=arc] a",
      (link) => (link as HTMLElement).style.transform,
    );
    await page.waitForTimeout(400);
    expect(
      await page.$eval("[data-node-id=arc] a", (link) => (link as HTMLElement).style.transform),
    ).not.toBe(first);
    await page.close();

    const reduced = await openEffectsPage(
      browser,
      `<div data-node-id="arc" style="height:300px">${pictures(6)}</div>`,
      [{ nodeId: "arc", module: "depth", behaviour: "arcCarousel" }],
      { reducedMotion: "reduce" },
    );
    await waitFor(
      reduced.page,
      () => (document.querySelector("[data-node-id=arc]") as HTMLElement).style.display === "flex",
    );
    expect(
      await reduced.page.$eval(
        "[data-node-id=arc] a",
        (link) => (link as HTMLElement).style.transform,
      ),
    ).toBe("");
    await reduced.page.close();
  });
});

describe("3D card stacks", () => {
  const cards = `<a href="#1">One</a><a href="#2">Two</a><a href="#3">Three</a>`;
  const inert = (page: Page) =>
    page.$$eval("[data-node-id=k] a", (links) => links.map((link) => (link as HTMLElement).inert));

  it("fans the cards out", async () => {
    const { page } = await openEffectsPage(browser, `<div data-node-id="k">${cards}</div>`, [
      { nodeId: "k", module: "depth", behaviour: "cardStack", params: { look: "fan" } },
    ]);
    await waitFor(page, () =>
      (
        document.querySelector("[data-node-id=k] a:nth-child(2)") as HTMLElement
      ).style.transform.includes("rotate(6deg)"),
    );
    await page.close();
  });

  it("shows the next card as the page scrolls past", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div style="height:700px"></div><div data-node-id="k" style="height:200px">${cards}</div><div style="height:1400px"></div>`,
      [
        {
          nodeId: "k",
          module: "depth",
          behaviour: "cardStack",
          params: { look: "tilted", advance: "scroll" },
        },
      ],
    );
    await page.evaluate(() => window.scrollTo(0, 300));
    await waitFor(page, () =>
      document.querySelector("[data-node-id=k]")!.hasAttribute("aria-roledescription"),
    );
    await page.waitForTimeout(200);
    expect(await inert(page)).toEqual([false, true, true]);
    await page.evaluate(() => window.scrollTo(0, 950));
    await page.waitForTimeout(400);
    expect((await inert(page)).indexOf(false)).toBeGreaterThan(0);
    await page.close();
  });
});

describe("depth on scroll", () => {
  it("moves nearer layers further as the page scrolls, and leaves them flat with less motion", async () => {
    const html = `<div style="height:900px"></div><section data-node-id="s"><h2>Near</h2><p>Middle</p><p>Far</p></section><div style="height:1500px"></div>`;
    const effect = { nodeId: "s", module: "scroll", behaviour: "depthOnScroll", params: {} };
    const { page } = await openEffectsPage(browser, html, [effect]);
    await page.evaluate(() => window.scrollTo(0, 500));
    await waitFor(
      page,
      () => (document.querySelector("[data-node-id=s] h2") as HTMLElement).style.transform !== "",
    );
    await page.waitForTimeout(200);
    const travel = () =>
      page.$$eval("[data-node-id=s] > *", (layers) =>
        layers.map((layer) =>
          Number(/, (-?[\d.]+)px,/.exec((layer as HTMLElement).style.transform)?.[1]),
        ),
      );
    const [near, , far] = await travel();
    expect(Math.abs(near!)).toBeGreaterThan(Math.abs(far!) - 0.01);
    expect(
      await page.$eval("[data-node-id=s]", (section) => (section as HTMLElement).style.perspective),
    ).toBe("1000px");
    await page.close();

    const reduced = await openEffectsPage(browser, html, [effect], { reducedMotion: "reduce" });
    await reduced.page.evaluate(() => window.scrollTo(0, 500));
    await reduced.page.waitForTimeout(600);
    expect(
      await reduced.page.$eval(
        "[data-node-id=s] h2",
        (layer) => (layer as HTMLElement).style.transform,
      ),
    ).toBe("");
    await reduced.page.close();
  });
});
