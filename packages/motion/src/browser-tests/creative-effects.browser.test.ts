import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser } from "./harness.js";
import { openEffectsPage, waitFor } from "./effects-harness.js";

/**
 * The creative pack's shader backgrounds and picture effects, played by the real site
 * runtime and modules: they draw, keep words readable, share one WebGL context, and leave
 * the plain background or picture where WebGL is missing or less motion is asked for.
 */

let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

const tall = `<div style="height:1400px"></div>`;
const picture = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#d04020"/><rect width="150" height="200" fill="#2050d0"/></svg>`;
const pictures = { "/picture.svg": picture };

/** How many of a canvas's pixels have been painted. */
const paintedPixels = (page: Page, selector: string) =>
  page.$eval(selector, (canvas) => {
    const element = canvas as HTMLCanvasElement;
    const drawing = element.getContext("2d");
    if (!drawing || element.width === 0) return 0;
    const data = drawing.getImageData(0, 0, element.width, element.height).data;
    let count = 0;
    for (let index = 3; index < data.length; index += 4) if (data[index]! > 0) count += 1;
    return count;
  });

describe("shader backgrounds", () => {
  it("draws a moving gradient behind the words, through a plain 2D canvas", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<section data-node-id="s" style="height:300px;background:#ffffff;color:#111111"><h2>Fresh bread</h2></section>`,
      [
        {
          nodeId: "s",
          module: "shader-backgrounds",
          behaviour: "shaderBackground",
          params: { look: "mesh", one: "#ff0000", two: "#0000ff", strength: 1 },
        },
      ],
    );
    await waitFor(page, () => document.querySelector("[data-node-id=s] canvas") !== null);
    const canvas = "[data-node-id=s] canvas";
    expect(await paintedPixels(page, canvas)).toBeGreaterThan(0);
    const layer = await page.$eval(canvas, (element) => ({
      hidden: element.getAttribute("aria-hidden"),
      zIndex: getComputedStyle(element).zIndex,
      isolation: getComputedStyle(element.parentElement!).isolation,
    }));
    expect(layer).toEqual({ hidden: "true", zIndex: "-1", isolation: "isolate" });
    // The words are still on top: the topmost element at their place is the heading.
    expect(
      await page.evaluate(() => {
        const box = document.querySelector("h2")!.getBoundingClientRect();
        return document.elementFromPoint(box.left + 5, box.top + box.height / 2)?.tagName;
      }),
    ).toBe("H2");
    await page.close();
  });

  it("shares one WebGL context however many backgrounds the page has", async () => {
    const { page } = await openEffectsPage(
      browser,
      ["a", "b", "c", "d"]
        .map((id) => `<section data-node-id="${id}" style="height:150px"><p>Words</p></section>`)
        .join(""),
      ["a", "b", "c", "d"].map((nodeId, index) => ({
        nodeId,
        module: "shader-backgrounds",
        behaviour: "shaderBackground",
        params: { look: ["mesh", "light", "dust", "contours"][index]! },
      })),
    );
    await waitFor(page, () => document.querySelectorAll("section canvas").length === 4);
    const contexts = await page.$$eval("section canvas", (canvases) =>
      canvases.map((canvas) => ((canvas as HTMLCanvasElement).getContext("2d") ? "2d" : "other")),
    );
    expect(contexts).toEqual(["2d", "2d", "2d", "2d"]);
    for (const id of ["a", "b"]) {
      expect(await paintedPixels(page, `[data-node-id=${id}] canvas`), id).toBeGreaterThan(0);
    }
    await page.close();
  });

  it("lays a veil under light words on a pale background, and none under dark words", async () => {
    const binding = (nodeId: string) => ({
      nodeId,
      module: "shader-backgrounds",
      behaviour: "shaderBackground",
      params: { look: "light", background: "#eeeeee", light: "#ffffff", readable: true },
    });
    const { page } = await openEffectsPage(
      browser,
      `<section data-node-id="light" style="height:200px;color:#ffffff"><h2>White words</h2></section>
       <section data-node-id="dark" style="height:200px;color:#111111"><h2>Dark words</h2></section>`,
      [binding("light"), binding("dark")],
    );
    await waitFor(page, () => document.querySelectorAll("section canvas").length === 2);
    const veil = (id: string) =>
      page.$eval(`[data-node-id=${id}] canvas + div`, (element) => ({
        shown: getComputedStyle(element).display !== "none",
        background: getComputedStyle(element).backgroundColor,
      }));
    const light = await veil("light");
    expect(light.shown).toBe(true);
    expect(light.background).toMatch(/^rgba\(0, 0, 0, 0\.\d+\)$/);
    expect((await veil("dark")).shown).toBe(false);
    await page.close();
  });

  it.each(["dust", "contours"])(
    "keeps the section's own picture under %s used alone, and lets it show through",
    async (look) => {
      const { page } = await openEffectsPage(
        browser,
        `<section data-node-id="s" style="height:300px;color:#ffffff;background-color:#101010;background-image:linear-gradient(#0a0,#0a0)"><h2>Words</h2></section>`,
        [
          {
            nodeId: "s",
            module: "shader-backgrounds",
            behaviour: "shaderBackground",
            params: { look, colour: "#ff0000", strength: 0.4 },
          },
        ],
      );
      await waitFor(page, () => document.querySelector("[data-node-id=s] canvas") !== null);
      await waitFor(page, () => {
        const canvas = document.querySelector<HTMLCanvasElement>("[data-node-id=s] canvas");
        return canvas !== null && canvas.width > 0 && canvas.style.visibility !== "hidden";
      });
      await page.waitForTimeout(200);
      const seen = await page.$eval("[data-node-id=s]", (element) => {
        const canvas = element.querySelector("canvas")!;
        const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
        let clear = 0;
        for (let at = 3; at < data.length; at += 4) if (data[at]! < 128) clear += 1;
        return {
          image: getComputedStyle(element).backgroundImage,
          clear: clear / (data.length / 4),
        };
      });
      expect(seen.image).toContain("linear-gradient");
      expect(seen.clear).toBeGreaterThan(0.5);
      await page.close();
    },
  );

  it("still steps a mesh's static look aside once it draws", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<section data-node-id="s" style="height:200px;background-image:linear-gradient(#0a0,#0a0)"></section>`,
      [
        {
          nodeId: "s",
          module: "shader-backgrounds",
          behaviour: "shaderBackground",
          params: { look: "mesh", one: "#ff0000", two: "#0000ff" },
        },
      ],
    );
    await waitFor(
      page,
      () =>
        getComputedStyle(document.querySelector("[data-node-id=s]")!).backgroundImage === "none",
    );
    await page.close();
  });

  it("keeps the static look where there is no WebGL, and still lays the veil", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<section data-node-id="s" style="height:200px;color:#ffffff;background-image:linear-gradient(#f0f0f0,#ffffff)"><h2>Words</h2></section>`,
      [
        {
          nodeId: "s",
          module: "shader-backgrounds",
          behaviour: "shaderBackground",
          params: { look: "mesh", readable: true, one: "#f0f0f0", two: "#ffffff" },
        },
      ],
      { withoutWebGl: true },
    );
    await waitFor(page, () => document.querySelector("[data-node-id=s] canvas + div") !== null);
    await page.waitForTimeout(200);
    expect(await paintedPixels(page, "[data-node-id=s] canvas")).toBe(0);
    expect(
      await page.$eval("[data-node-id=s]", (element) => getComputedStyle(element).backgroundImage),
    ).toContain("linear-gradient");
    expect(
      await page.$eval(
        "[data-node-id=s] canvas + div",
        (element) => getComputedStyle(element).display,
      ),
    ).toBe("block");
    await page.close();
  });

  it("leaves pictures as they are where there is no WebGL", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<figure data-node-id="p" style="margin:0"><img src="/picture.svg" alt="" style="width:300px;height:200px;display:block"></figure>`,
      [{ nodeId: "p", module: "picture-effects", behaviour: "developReveal" }],
      { pages: pictures, withoutWebGl: true },
    );
    await page.waitForTimeout(800);
    expect(await page.$$eval("[data-node-id=p] canvas", (list) => list.length)).toBe(0);
    expect(
      await page.$eval("[data-node-id=p] img", (image) => getComputedStyle(image).opacity),
    ).toBe("1");
    await page.close();
  });

  it("draws one still frame for people who ask for less motion", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<section data-node-id="s" style="height:200px;background:#101010;color:#ffffff"><p>Words</p></section>`,
      [
        {
          nodeId: "s",
          module: "shader-backgrounds",
          behaviour: "shaderBackground",
          params: { look: "dust", strength: 1 },
        },
      ],
      { reducedMotion: "reduce" },
    );
    await waitFor(page, () => document.querySelector("[data-node-id=s] canvas") !== null);
    await page.waitForTimeout(300);
    const first = await page.$eval("[data-node-id=s] canvas", (canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );
    expect(await paintedPixels(page, "[data-node-id=s] canvas")).toBeGreaterThan(0);
    await page.waitForTimeout(400);
    expect(
      await page.$eval("[data-node-id=s] canvas", (canvas) =>
        (canvas as HTMLCanvasElement).toDataURL(),
      ),
    ).toBe(first);
    await page.close();
  });

  it("lays film grain over the section without WebGL, still for less motion", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<section data-node-id="g" style="height:200px"><p>Words</p></section>`,
      [{ nodeId: "g", module: "film-grain", behaviour: "filmGrain", params: { strength: 0.5 } }],
      { reducedMotion: "reduce" },
    );
    await waitFor(page, () => document.querySelector("[data-lintel-grain]") !== null);
    const grain = await page.$eval("[data-lintel-grain]", (element) => ({
      image: getComputedStyle(element).backgroundImage.startsWith("url("),
      animation: getComputedStyle(element).animationName,
      blend: getComputedStyle(element.parentElement!).mixBlendMode,
      pointer: getComputedStyle(element.parentElement!).pointerEvents,
    }));
    expect(grain).toEqual({ image: true, animation: "none", blend: "overlay", pointer: "none" });
    await page.close();
  });
});

describe("picture effects", () => {
  const imageAt = (id: string) =>
    `<figure data-node-id="${id}" style="margin:0"><img src="/picture.svg" alt="Loaves" style="width:300px;height:200px;object-fit:cover;display:block"></figure>`;

  it("develops a picture out of noise as it comes into view, then hands back the real picture", async () => {
    const { page } = await openEffectsPage(
      browser,
      `${tall}${imageAt("p")}${tall}`,
      [
        {
          nodeId: "p",
          module: "picture-effects",
          behaviour: "developReveal",
          params: { speed: 3 },
        },
      ],
      { pages: pictures },
    );
    await page.mouse.wheel(0, 900);
    await waitFor(page, () => document.querySelector("[data-node-id=p] canvas") !== null);
    expect(
      await page.$eval("[data-node-id=p] img", (image) => getComputedStyle(image).opacity),
    ).toBe("0");
    await page.mouse.wheel(0, 700);
    await waitFor(page, () => document.querySelector("[data-node-id=p] canvas") === null, 6000);
    expect(
      await page.$eval("[data-node-id=p] img", (image) => getComputedStyle(image).opacity),
    ).toBe("1");
    await page.close();
  });

  it("pixelates a picture in, in steps, then hands back the real picture", async () => {
    const { page } = await openEffectsPage(
      browser,
      imageAt("p"),
      [{ nodeId: "p", module: "picture-effects", behaviour: "pixelReveal", params: { speed: 3 } }],
      { pages: pictures },
    );
    await waitFor(page, () => document.querySelector("[data-node-id=p] canvas") !== null);
    await waitFor(page, () => document.querySelector("[data-node-id=p] canvas") === null, 6000);
    expect(
      await page.$eval("[data-node-id=p] img", (image) => getComputedStyle(image).opacity),
    ).toBe("1");
    await page.close();
  });

  it("leaves the picture as it is for people who ask for less motion", async () => {
    const { page } = await openEffectsPage(
      browser,
      imageAt("p"),
      [
        { nodeId: "p", module: "picture-effects", behaviour: "developReveal" },
        { nodeId: "p", module: "picture-effects", behaviour: "colourSplit" },
      ],
      { pages: pictures, reducedMotion: "reduce" },
    );
    await page.waitForTimeout(800);
    expect(await page.$$eval("[data-node-id=p] canvas", (list) => list.length)).toBe(0);
    expect(
      await page.$eval("[data-node-id=p] img", (image) => getComputedStyle(image).opacity),
    ).toBe("1");
    await page.close();
  });

  it("parts the colours while the pointer moves over the picture, then fades away", async () => {
    const { page } = await openEffectsPage(
      browser,
      imageAt("p"),
      [
        {
          nodeId: "p",
          module: "picture-effects",
          behaviour: "colourSplit",
          params: { strength: 1 },
        },
      ],
      { pages: pictures },
    );
    await waitFor(page, () => document.querySelector("[data-node-id=p] canvas") !== null);
    await page.mouse.move(20, 20);
    for (let step = 1; step < 10; step += 1) {
      await page.mouse.move(20 + step * 25, 20 + step * 15);
      await page.waitForTimeout(16);
    }
    await waitFor(
      page,
      () =>
        (document.querySelector("[data-node-id=p] canvas") as HTMLElement).style.opacity === "1",
    );
    await page.mouse.move(700, 500);
    await waitFor(
      page,
      () =>
        (document.querySelector("[data-node-id=p] canvas") as HTMLElement).style.opacity === "0",
    );
    await page.close();
  });
});
