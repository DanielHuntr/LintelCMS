import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser } from "./harness.js";
import { openEffectsPage, type OpenOptions } from "./effects-harness.js";

/**
 * Layers, reactions and custom shaders, played by the real site runtime and modules: they
 * draw through one context, blend, react, stay still for less motion, and leave a plain
 * background with readable words whenever a shader can't run.
 */

let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

/** Checks from here, rather than in the page, until `check` holds. */
async function waitFor(check: () => Promise<boolean> | boolean, what: string) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  throw new Error(`Waited for ${what}`);
}

const layer = (look: string, values: object = {}, extra: object = {}) => ({
  look,
  values: { speed: 1, strength: 0.5, ...values },
  blend: "normal",
  opacity: 1,
  ...extra,
});

const custom = (code: string, values: object = {}, extra: object = {}) => ({
  code,
  values,
  blend: "normal",
  opacity: 1,
  ...extra,
});

const section = (css = "background:#fff;color:#111") =>
  `<section data-node-id="s" style="height:400px;padding:30px;${css}"><p>Words</p></section><div style="height:1600px"></div>`;

function open(layers: unknown[], html = section(), options: OpenOptions = {}, readable = true) {
  return openEffectsPage(
    browser,
    html,
    [
      {
        nodeId: "s",
        module: "shader-stack",
        behaviour: "shaderStack",
        params: { plan: JSON.stringify({ layers, readable }) },
      },
    ],
    options,
  );
}

/** A section's canvas as one average colour, 0 to 255, or null without one. */
const averageColour = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector("section canvas") as HTMLCanvasElement | null;
    const drawing = canvas?.getContext("2d");
    if (!canvas || !drawing || canvas.width === 0) return null;
    const { data } = drawing.getImageData(0, 0, canvas.width, canvas.height);
    const sums = [0, 0, 0, 0];
    for (let at = 0; at < data.length; at += 4) {
      for (let part = 0; part < 4; part += 1) sums[part]! += data[at + part]!;
    }
    return sums.map((sum) => sum / (data.length / 4));
  });

const whenDrawn = (page: Page) =>
  waitFor(async () => ((await averageColour(page))?.[3] ?? 0) > 0, "the drawing");

const canvasHidden = (page: Page) =>
  page.$$eval("section canvas", (canvases) =>
    canvases.some((canvas) => (canvas as HTMLElement).style.visibility === "hidden"),
  );

const veil = (page: Page) =>
  page.$$eval("section > div[aria-hidden]", (layers) =>
    layers.map((layer) => (layer as HTMLElement).style.background).join(" "),
  );

const red = `void main(){gl_FragColor=vec4(1.,0.,0.,1.);}`;

describe("layers", () => {
  it("draws every layer through one WebGL context", async () => {
    const { page } = await openEffectsPage(
      browser,
      `${section()}<section data-node-id="t" style="height:300px"></section>`,
      ["s", "t"].map((nodeId) => ({
        nodeId,
        module: "shader-stack",
        behaviour: "shaderStack",
        params: {
          plan: JSON.stringify({ layers: [layer("mesh"), layer("glass"), layer("grain")] }),
        },
      })),
      {
        beforePageLoads: () => {
          const original = HTMLCanvasElement.prototype.getContext;
          const counted = new Set<unknown>();
          Object.assign(window, { webglCanvases: counted });
          Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
            value(this: HTMLCanvasElement, kind: string, settings?: unknown) {
              if (kind.startsWith("webgl")) counted.add(this);
              return original.call(this, kind as "2d", settings);
            },
          });
        },
      },
    );
    await whenDrawn(page);
    expect(
      await page.evaluate(
        () => (window as unknown as { webglCanvases: Set<unknown> }).webglCanvases.size,
      ),
    ).toBe(1);
    await page.close();
  });

  it("blends a layer with what's under it, including the section's own colour", async () => {
    const half = `void main(){gl_FragColor=vec4(.5,.5,.5,1.);}`;
    const { page } = await open(
      [custom(half, {}, { blend: "multiply" })],
      section("background:#ff0000;color:#fff"),
    );
    await whenDrawn(page);
    const [r, g] = (await averageColour(page))!;
    expect(r).toBeGreaterThan(115);
    expect(r).toBeLessThan(140);
    expect(g).toBeLessThan(5);
    await page.close();
  });

  it("keeps opacity and order: the top layer wins, by its opacity", async () => {
    const blue = `void main(){gl_FragColor=vec4(0.,0.,1.,1.);}`;
    const { page } = await open([custom(red), custom(blue, {}, { opacity: 0.25 })]);
    await whenDrawn(page);
    const [r, , b] = (await averageColour(page))!;
    expect(r).toBeGreaterThan(180);
    expect(b).toBeGreaterThan(50);
    expect(b).toBeLessThan(75);
    await page.close();
  });

  it("lets a filter rework the layer under it", async () => {
    const { page } = await open([
      custom(red),
      layer("dither", { ink: "#000000", paper: "#ffffff", detail: 2 }),
    ]);
    await whenDrawn(page);
    // Red is dark enough for the pattern to be part ink, part paper.
    const [r] = (await averageColour(page))!;
    expect(r).toBeGreaterThan(20);
    expect(r).toBeLessThan(250);
    await page.close();
  });

  it("deepens the veil from what is really drawn, so words stay readable over the stack", async () => {
    const { page } = await open([custom(`void main(){gl_FragColor=vec4(0.,0.,0.,1.);}`)]);
    await whenDrawn(page);
    await waitFor(async () => /255, 255, 255/.test(await veil(page)), "a light veil");
    await page.close();
  });

  it("keeps a section's own picture under layers that lay over it", async () => {
    const picture = "background-image:linear-gradient(#0a0,#0a0);background-color:#fff;color:#111";
    const { page } = await open(
      [layer("dust", { colour: "#ff0000" })],
      section(picture),
      {},
      false,
    );
    await whenDrawn(page);
    const seen = await page.evaluate(() => {
      const element = document.querySelector("section")!;
      const canvas = element.querySelector("canvas")!;
      const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
      let clear = 0;
      for (let at = 3; at < data.length; at += 4) if (data[at] === 0) clear += 1;
      return {
        image: getComputedStyle(element).backgroundImage,
        clear: clear / (data.length / 4),
      };
    });
    expect(seen.image).toContain("linear-gradient");
    expect(seen.clear).toBeGreaterThan(0.5);
    await page.close();
  });

  it("gives film grain as a layer the Size it has alone", async () => {
    const spread = async (size: string) => {
      const { page } = await open([layer("grain", { strength: 1, size })]);
      await whenDrawn(page);
      const runs = await page.evaluate(() => {
        const canvas = document.querySelector("section canvas") as HTMLCanvasElement;
        const row = canvas.getContext("2d")!.getImageData(0, 20, canvas.width, 1).data;
        let changes = 0;
        for (let at = 4; at < row.length; at += 4) if (row[at] !== row[at - 4]) changes += 1;
        return changes;
      });
      await page.close();
      return runs;
    };
    const [fine, coarse] = [await spread("fine"), await spread("coarse")];
    expect(coarse).toBeLessThan(fine * 0.7);
  });

  it("leaves words alone when asked to", async () => {
    const { page } = await open(
      [custom(`void main(){gl_FragColor=vec4(0.,0.,0.,1.);}`)],
      section(),
      {},
      false,
    );
    await whenDrawn(page);
    expect(await veil(page)).toBe("");
    await page.close();
  });
});

describe("reacting", () => {
  const grey = `uniform float level; // @slider min=0 max=1 value=0
void main(){gl_FragColor=vec4(vec3(level),1.);}`;

  it("drives a number from scrolling", async () => {
    const { page } = await open(
      [custom(grey, { level: 0 }, { reacts: { level: { source: "scroll", to: 1 } } })],
      `<div style="height:300px"></div>${section()}`,
    );
    await whenDrawn(page);
    const before = (await averageColour(page))![0]!;
    await page.evaluate(() => window.scrollTo(0, 500));
    await waitFor(async () => (await averageColour(page))![0]! > before + 30, "a brighter drawing");
    await page.close();
  });

  it("drives a number from the pointer", async () => {
    const { page } = await open([
      custom(grey, { level: 0 }, { reacts: { level: { source: "pointerX", to: 1 } } }),
    ]);
    await whenDrawn(page);
    await page.mouse.move(10, 100);
    await page.mouse.move(980, 100);
    await waitFor(async () => (await averageColour(page))![0]! > 170, "a brighter drawing");
    await page.close();
  });

  it("drives a number from a timeline", async () => {
    const { page } = await open([
      custom(grey, { level: 0 }, { reacts: { level: { source: "timeline", to: 1, seconds: 1 } } }),
    ]);
    await whenDrawn(page);
    const seen = new Set<number>();
    await waitFor(async () => {
      seen.add(Math.round((await averageColour(page))![0]! / 40));
      return seen.size >= 3;
    }, "the drawing changing");
    await page.close();
  });

  it("drives speed, which sets how time runs rather than what's drawn", async () => {
    const clock = `void main(){gl_FragColor=vec4(vec3(fract(time*.02)),1.);}`;
    const { page } = await open([
      custom(clock, { speed: 0 }, { reacts: { speed: { source: "timeline", to: 3, seconds: 1 } } }),
    ]);
    await whenDrawn(page);
    const first = (await averageColour(page))![0]!;
    await waitFor(
      async () => Math.abs((await averageColour(page))![0]! - first) > 6,
      "time moving, from a speed of 0",
    );
    await page.close();
  });

  it("drives a layer's own opacity", async () => {
    const { page } = await open(
      [
        custom(
          red,
          {},
          {
            opacity: 0,
            reacts: { layerOpacity: { source: "pointerX", to: 1 } },
          },
        ),
      ],
      section("background:#fff;color:#111"),
    );
    await whenDrawn(page);
    await page.mouse.move(10, 100);
    await page.mouse.move(980, 100);
    await waitFor(async () => (await averageColour(page))![1]! < 120, "the layer showing");
    await page.close();
  });

  it("stays still with one frame for less motion, whatever it reacts to", async () => {
    const { page } = await open(
      [
        custom(
          grey,
          { level: 0.5 },
          { reacts: { level: { source: "timeline", to: 1, seconds: 1 } } },
        ),
      ],
      section(),
      { reducedMotion: "reduce" },
    );
    await whenDrawn(page);
    const first = await averageColour(page);
    await page.waitForTimeout(500);
    expect(await averageColour(page)).toEqual(first);
    expect(first![0]).toBeGreaterThan(115);
    expect(first![0]).toBeLessThan(140);
    await page.close();
  });
});

describe("custom shaders", () => {
  it("runs code from the page's list by name, with controls set", async () => {
    const code = `uniform vec3 tint; // @colour value=#000000
uniform bool on; // @toggle value=off
uniform int level; // @slider min=0 max=2 value=0
void main(){gl_FragColor=vec4(on?tint:vec3(0.),1.);if(level==2)gl_FragColor.g=1.;}`;
    const opened = await open(
      [
        {
          shader: "rings",
          values: { tint: "#ff0000", on: true, level: 2 },
          blend: "normal",
          opacity: 1,
        },
      ],
      section(),
      { shaders: { rings: code } },
    );
    await whenDrawn(opened.page);
    const [r, g, b] = (await averageColour(opened.page))!;
    expect([Math.round(r!), Math.round(g!), Math.round(b!)]).toEqual([255, 255, 0]);
    await opened.page.close();
  });

  const fallsBack = async (layers: unknown[], html = section(), options: OpenOptions = {}) => {
    const { page } = await open(layers, html, options);
    await waitFor(() => canvasHidden(page), "the drawing to step aside");
    return page;
  };

  it("leaves the plain background when the code doesn't compile", async () => {
    const page = await fallsBack([custom(`void main(){gl_FragColor=nonsense;}`)]);
    await page.close();
  });

  it("leaves the plain background when the code fails the checks, without compiling it", async () => {
    const page = await fallsBack([custom(`void main(){while(true){}}`)]);
    await page.close();
  });

  it("keeps the other layers when one custom layer fails", async () => {
    const { page } = await open([layer("mesh"), custom(`void main(){nonsense();}`)]);
    await whenDrawn(page);
    expect(await canvasHidden(page)).toBe(false);
    await page.close();
  });

  it("keeps white words readable when the dark shader meant to be under them can't run", async () => {
    const page = await fallsBack(
      [custom(`void main(){nonsense();}`)],
      section("background:#fff;color:#fff"),
    );
    expect(await veil(page)).toMatch(/\(0, 0, 0/);
    await page.close();
  });

  it("does the same with no WebGL at all", async () => {
    const { page } = await open([layer("mesh")], section("background:#fff;color:#fff"), {
      withoutWebGl: true,
    });
    await waitFor(async () => /\(0, 0, 0/.test(await veil(page)), "a veil");
    await page.close();
  });

  it("stops on a lost context, doesn't try that shader again, and lets looks come back", async () => {
    const { page } = await openEffectsPage(
      browser,
      `${section()}<section data-node-id="t" style="height:300px;background:#fff"></section>`,
      [
        {
          nodeId: "s",
          module: "shader-stack",
          behaviour: "shaderStack",
          params: { plan: JSON.stringify({ layers: [custom(red)] }) },
        },
        {
          nodeId: "t",
          module: "shader-stack",
          behaviour: "shaderStack",
          params: { plan: JSON.stringify({ layers: [layer("mesh")] }) },
        },
      ],
      {
        viewport: { width: 800, height: 900 },
        beforePageLoads: () => {
          const original = HTMLCanvasElement.prototype.getContext;
          Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
            value(this: HTMLCanvasElement, kind: string, settings?: unknown) {
              const made = original.call(this, kind as "2d", settings);
              if (kind.startsWith("webgl")) Object.assign(window, { shared: made });
              return made;
            },
          });
        },
      },
    );
    await whenDrawn(page);
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const gl = (window as unknown as { shared: WebGLRenderingContext }).shared;
      const lose = gl.getExtension("WEBGL_lose_context")!;
      lose.loseContext();
      setTimeout(() => lose.restoreContext(), 100);
    });
    await waitFor(() => canvasHidden(page), "the custom drawing to step aside");
    const struck = await page.evaluate(() => sessionStorage.getItem("lintel-shader-strikes"));
    expect(struck).toBeTruthy();
    await page.waitForTimeout(500);
    expect(await canvasHidden(page)).toBe(true);
    await waitFor(
      () =>
        page.$$eval("section:nth-of-type(2) canvas", (canvases) =>
          canvases.every((canvas) => (canvas as HTMLElement).style.visibility !== "hidden"),
        ),
      "the look to come back",
    );
    await page.close();
  });
});
