import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser } from "./harness.js";
import { effectsDocument, openEffectsPage, waitFor } from "./effects-harness.js";

/** One or more effects from each family, played by the real site runtime and modules. */

let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

const read = (page: Page, selector: string, property: string) =>
  page.$eval(
    selector,
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property,
  );
const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const tall = `<div style="height:1600px"></div>`;

describe("loading effects", () => {
  it("imports a module only when an element using it comes near the screen, and only once", async () => {
    const { page, requested } = await openEffectsPage(
      browser,
      `<h2 data-node-id="a">Hello</h2><h2 data-node-id="b">There</h2>${tall}${tall}<button data-node-id="far">Far</button>`,
      [
        { nodeId: "a", module: "text", behaviour: "markerHighlight" },
        { nodeId: "b", module: "text", behaviour: "markerHighlight" },
        { nodeId: "far", module: "pointer", behaviour: "magnetic" },
      ],
    );
    await waitFor(
      page,
      () =>
        getComputedStyle(document.querySelector("[data-node-id=a]")!).backgroundImage !== "none",
    );
    const loaded = (name: string) =>
      requested.filter((path) => path.startsWith(`/_lintel/effects/${name}-`));
    expect(loaded("text")).toHaveLength(1);
    expect(loaded("pointer")).toHaveLength(0);
    await page.mouse.wheel(0, 3200);
    await waitFor(page, () => document.querySelector("[data-node-id=far]") !== null);
    await page.waitForTimeout(400);
    expect(loaded("pointer")).toHaveLength(1);
    await page.close();
  });

  it("shows the content as it is without JavaScript: effects only add to it", async () => {
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.setContent(
      effectsDocument(
        `<h2 data-node-id="a">Plain words</h2>`,
        [{ nodeId: "a", module: "text", behaviour: "scramble" }],
        {},
      ),
    );
    expect(await page.textContent("h2")).toBe("Plain words");
    await page.close();
  });
});

describe("text", () => {
  it("scrambles, then settles on the real words, read once by screen readers", async () => {
    const { page } = await openEffectsPage(browser, `<h2 data-node-id="t">Fresh bread daily</h2>`, [
      { nodeId: "t", module: "text", behaviour: "scramble", params: { duration: 300 } },
    ]);
    await waitFor(page, () => document.querySelector("[data-node-id=t] [aria-hidden]") !== null);
    await pause(600);
    expect(await page.textContent("[data-node-id=t] [aria-hidden]")).toBe("Fresh bread daily");
    expect(await page.textContent("[data-node-id=t] span:not([aria-hidden])")).toBe(
      "Fresh bread daily",
    );
    await page.close();
  });

  it("counts numbers up and keeps their separators", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<p data-node-id="c">Over 1,250 happy customers</p>`,
      [{ nodeId: "c", module: "text", behaviour: "countUp", params: { duration: 300 } }],
    );
    await waitFor(
      page,
      () =>
        document.querySelector("[data-node-id=c] [aria-hidden]")?.textContent ===
        "Over 1,250 happy customers",
    );
    await page.close();
  });
});

describe("pointer", () => {
  it("pulls a magnetic button towards the pointer, and leaves it still for less motion", async () => {
    const html = `<div style="padding:200px"><button data-node-id="m" style="width:120px;height:40px">Book</button></div>`;
    const effect = [
      { nodeId: "m", module: "pointer", behaviour: "magnetic", params: { strength: 0.5 } },
    ];
    const { page } = await openEffectsPage(browser, html, effect);
    await page.waitForTimeout(300);
    const box = (await page.locator("button").boundingBox())!;
    await page.mouse.move(box.x + box.width, box.y + box.height);
    await waitFor(
      page,
      () => (document.querySelector("button")!.style.translate || "0px") !== "0px",
    );
    const reduced = await openEffectsPage(browser, html, effect, { reducedMotion: "reduce" });
    await reduced.page.waitForTimeout(300);
    await reduced.page.mouse.move(box.x + box.width, box.y + box.height);
    await reduced.page.waitForTimeout(300);
    expect(await reduced.page.$eval("button", (button) => button.style.translate)).toBe("");
    await page.close();
    await reduced.page.close();
  });

  it("tilts a card and lifts it on keyboard focus too", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div style="padding:100px"><a href="#" data-node-id="c" style="display:block;width:300px;height:200px">Card</a></div>`,
      [{ nodeId: "c", module: "pointer", behaviour: "tilt", params: { glare: true } }],
    );
    await page.waitForTimeout(300);
    await page.mouse.move(130, 130);
    await waitFor(page, () =>
      document.querySelector<HTMLElement>("[data-node-id=c]")!.style.transform.includes("rotateX"),
    );
    await page.keyboard.press("Tab");
    expect(
      await page.$eval("[data-node-id=c]", (card) => (card as HTMLElement).style.scale),
    ).not.toBe("");
    await page.close();
  });
});

describe("scroll", () => {
  it("leans with scroll speed and straightens when the page stops", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div style="height:500px"></div><h2 data-node-id="s">Speed</h2>${tall}${tall}`,
      [{ nodeId: "s", module: "scroll", behaviour: "velocitySkew" }],
    );
    await page.waitForTimeout(300);
    for (let step = 0; step < 6; step += 1) {
      await page.mouse.wheel(0, 60);
      await page.waitForTimeout(16);
    }
    await waitFor(page, () =>
      document.querySelector<HTMLElement>("[data-node-id=s]")!.style.transform.startsWith("skewY("),
    );
    await waitFor(
      page,
      () =>
        document.querySelector<HTMLElement>("[data-node-id=s]")!.style.transform === "skewY(0deg)",
      3000,
    );
    await page.close();
  });

  it("draws an SVG line in step with the scroll", async () => {
    const svg = `<div style="height:700px"></div><div data-node-id="d"><svg width="200" height="20"><path d="M0 10 H200" stroke="black"/></svg></div>${tall}`;
    const { page } = await openEffectsPage(browser, svg, [
      { nodeId: "d", module: "scroll", behaviour: "pathDraw", params: { start: 0, end: 1 } },
    ]);
    await page.waitForTimeout(300);
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(300);
    const offset = Number.parseFloat(await read(page, "path", "stroke-dashoffset"));
    expect(offset).toBeGreaterThan(0);
    expect(offset).toBeLessThan(200);
    await page.close();
  });
});

describe("3D", () => {
  it("turns a card stack with the arrow keys, keeping only the top card reachable", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div data-node-id="k"><a href="#1">One</a><a href="#2">Two</a><a href="#3">Three</a></div>`,
      [{ nodeId: "k", module: "depth", behaviour: "cardStack" }],
    );
    await waitFor(
      page,
      () =>
        document.querySelector("[data-node-id=k]")!.getAttribute("aria-roledescription") ===
        "card stack",
    );
    expect(
      await page.$$eval("[data-node-id=k] a", (links) =>
        links.map((link) => (link as HTMLElement).inert),
      ),
    ).toEqual([false, true, true]);
    await page.focus("[data-node-id=k]");
    await page.keyboard.press("ArrowRight");
    expect(
      await page.$$eval("[data-node-id=k] a", (links) =>
        links.map((link) => (link as HTMLElement).inert),
      ),
    ).toEqual([true, false, true]);
    await page.close();
  });
});

describe("physics", () => {
  it("springs a switch's knob across and says it is on", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div data-node-id="w" style="width:52px;height:28px;background:#ccc;border-radius:14px;padding:2px;box-sizing:border-box"><span style="display:block;width:24px;height:24px;border-radius:50%;background:#fff"></span></div>`,
      [{ nodeId: "w", module: "physics", behaviour: "springToggle" }],
    );
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=w]")!.getAttribute("role") === "switch",
    );
    await page.focus("[data-node-id=w]");
    await page.keyboard.press("Space");
    expect(await page.getAttribute("[data-node-id=w]", "aria-checked")).toBe("true");
    await waitFor(
      page,
      () =>
        Number.parseFloat(
          document.querySelector<HTMLElement>("[data-node-id=w] span")!.style.translate,
        ) > 20,
    );
    await page.close();
  });
});

describe("ready-made elements", () => {
  it("fans a round menu out, moves round it with arrow keys and closes on Escape", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<nav data-node-id="r" style="margin:200px"><button aria-expanded="false">Menu</button><ul><li><a href="#a">A</a></li><li><a href="#b">B</a></li><li><a href="#c">C</a></li></ul></nav>`,
      [{ nodeId: "r", module: "physics", behaviour: "radialMenu" }],
    );
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=r] a")?.getAttribute("tabindex") === "-1",
    );
    await page.focus("[data-node-id=r] button");
    await page.keyboard.press("Enter");
    expect(await page.getAttribute("[data-node-id=r] button", "aria-expanded")).toBe("true");
    await page.focus("[data-node-id=r] a[href='#a']");
    await page.keyboard.press("ArrowRight");
    expect(await page.evaluate(() => document.activeElement?.getAttribute("href"))).toBe("#b");
    await page.keyboard.press("Escape");
    expect(await page.getAttribute("[data-node-id=r] button", "aria-expanded")).toBe("false");
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BUTTON");
    await page.close();
  });

  it("slides a notification in as a polite live region, and its button dismisses it", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div data-node-id="n"><p>Free delivery</p><button aria-label="Close">×</button></div>`,
      [{ nodeId: "n", module: "intro", behaviour: "toast", params: { delay: 0.1, stay: 0 } }],
    );
    await waitFor(
      page,
      () => document.querySelector<HTMLElement>("[data-node-id=n]")!.style.visibility === "visible",
    );
    expect(await page.getAttribute("[data-node-id=n]", "aria-live")).toBe("polite");
    await page.waitForTimeout(600);
    await page.click("[data-node-id=n] button");
    await waitFor(
      page,
      () => document.querySelector<HTMLElement>("[data-node-id=n]")!.style.visibility === "hidden",
    );
    await page.close();
  });

  it("glides the tab marker to the chosen tab", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div data-node-id="tabs"><div role="tablist"><button role="tab" aria-selected="true" style="width:100px">One</button><button role="tab" aria-selected="false" style="width:140px">Two</button></div></div>`,
      [{ nodeId: "tabs", module: "physics", behaviour: "tabSlider" }],
    );
    await waitFor(
      page,
      () => document.querySelector("[role=tablist] > span[aria-hidden]") !== null,
    );
    await page.evaluate(() => {
      const [one, two] = document.querySelectorAll("[role=tab]");
      one!.setAttribute("aria-selected", "false");
      two!.setAttribute("aria-selected", "true");
    });
    await waitFor(
      page,
      () =>
        Math.abs(
          Number.parseFloat(
            document.querySelector<HTMLElement>("[role=tablist] > span[aria-hidden]")!.style.width,
          ) - 140,
        ) < 1,
      3000,
    );
    await page.close();
  });
});

describe("SVG", () => {
  it("morphs a shape through built-in outlines", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div data-node-id="g" style="width:100px;height:100px"></div>`,
      [{ nodeId: "g", module: "svg", behaviour: "morphShapes", params: { duration: 300 } }],
    );
    await waitFor(page, () => document.querySelector("[data-node-id=g] path") !== null);
    const first = await page.getAttribute("[data-node-id=g] path", "d");
    await page.waitForTimeout(500);
    expect(await page.getAttribute("[data-node-id=g] path", "d")).not.toBe(first);
    await page.close();
  });
});

describe("canvas and WebGL", () => {
  it("draws particles behind the content and keeps them out of reach of screen readers", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<section data-node-id="p" style="height:300px"><h2>Hello</h2></section>`,
      [
        {
          nodeId: "p",
          module: "particles",
          behaviour: "particleField",
          params: { colour: "#ff0000" },
        },
      ],
    );
    await waitFor(page, () => document.querySelector("[data-node-id=p] canvas") !== null);
    const painted = await page.$eval("[data-node-id=p] canvas", (canvas) => {
      const data = (canvas as HTMLCanvasElement)
        .getContext("2d")!
        .getImageData(
          0,
          0,
          (canvas as HTMLCanvasElement).width,
          (canvas as HTMLCanvasElement).height,
        ).data;
      let count = 0;
      for (let index = 3; index < data.length; index += 4) if (data[index]! > 0) count += 1;
      return { count, hidden: canvas.getAttribute("aria-hidden") };
    });
    expect(painted.count).toBeGreaterThan(0);
    expect(painted.hidden).toBe("true");
    await page.close();
  });

  // Resizing a canvas wipes it, and the first resize report repeated the size already set, so
  // the one still frame drawn for people who ask for less motion was erased and never came back.
  it("keeps the still frame for people who ask for less motion", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<section data-node-id="p" style="height:300px"><h2>Hello</h2></section>`,
      [
        {
          nodeId: "p",
          module: "particles",
          behaviour: "particleField",
          params: { colour: "#ff0000" },
        },
      ],
      { reducedMotion: "reduce" },
    );
    await waitFor(page, () => document.querySelector("[data-node-id=p] canvas") !== null);
    // Long enough for the resize report that used to wipe it.
    await page.waitForTimeout(300);
    const painted = await page.$eval("[data-node-id=p] canvas", (canvas) => {
      const element = canvas as HTMLCanvasElement;
      const data = element.getContext("2d")!.getImageData(0, 0, element.width, element.height).data;
      let count = 0;
      for (let index = 3; index < data.length; index += 4) if (data[index]! > 0) count += 1;
      return count;
    });
    expect(painted).toBeGreaterThan(0);
    await page.close();
  });

  it("paints the liquid gradient with WebGL", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<section data-node-id="l" style="height:200px"></section>`,
      [{ nodeId: "l", module: "liquid-gradient", behaviour: "liquidGradient" }],
    );
    await waitFor(page, () => document.querySelector("[data-node-id=l] canvas") !== null);
    expect(
      await page.$eval(
        "[data-node-id=l] canvas",
        (canvas) => (canvas as HTMLCanvasElement).getContext("webgl") !== null,
      ),
    ).toBe(true);
    await page.close();
  });
});

describe("cursor and marquee", () => {
  it("shows the site cursor for a mouse, keeping the normal cursor in fields", async () => {
    const { page } = await openEffectsPage(browser, `<input aria-label="Name">${tall}`, [], {
      site: {
        cursor: { style: "ring-and-dot", trail: "dots", colour: "#111111", size: 32 },
        pageTransition: { style: "none", duration: 400 },
        intro: { style: "none", text: "", background: "#000000", colour: "#ffffff" },
      },
    });
    await page.mouse.move(200, 200);
    await waitFor(page, () => document.querySelectorAll(".lintel-cursor").length === 2);
    expect(await read(page, "body", "cursor")).toBe("none");
    expect(await read(page, "input", "cursor")).toBe("auto");
    await page.close();
  });

  it("loops a marquee with hidden copies, so its items are met once", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div data-node-id="q"><span>Bread</span><span>Cakes</span></div>`,
      [{ nodeId: "q", module: "marquee", behaviour: "velocityMarquee", params: { speed: 200 } }],
    );
    await waitFor(page, () => document.querySelectorAll("[data-node-id=q] [data-copy]").length > 0);
    expect(
      await page.$$eval("[data-node-id=q] [data-copy]", (copies) =>
        copies.every(
          (copy) => copy.getAttribute("aria-hidden") === "true" && (copy as HTMLElement).inert,
        ),
      ),
    ).toBe(true);
    const before = await page.$eval(
      "[data-node-id=q] > div",
      (track) => (track as HTMLElement).style.transform,
    );
    await page.waitForTimeout(200);
    expect(
      await page.$eval("[data-node-id=q] > div", (track) => (track as HTMLElement).style.transform),
    ).not.toBe(before);
    await page.close();
  });
});

describe("intro and page transitions", () => {
  const off = {
    pageTransition: { style: "none", duration: 400 },
    cursor: { style: "none", trail: "none", colour: "#111111", size: 32 },
  };

  it("plays the intro once per visit, and Skip ends it at once", async () => {
    const intro = `<div class="lintel-intro"><span class="lintel-intro__count">0</span><button class="lintel-intro__skip">Skip intro</button></div>`;
    const { page } = await openEffectsPage(browser, `${intro}<a href="/next">Next</a>`, [], {
      site: {
        ...off,
        intro: { style: "counter", text: "", background: "#000000", colour: "#ffffff" },
      },
      pages: {
        "/next": effectsDocument(`${intro}<p>Next</p>`, [], {
          site: {
            ...off,
            intro: { style: "counter", text: "", background: "#000000", colour: "#ffffff" },
          },
        }),
      },
    });
    await waitFor(
      page,
      () =>
        document.querySelector(".lintel-intro")?.getAttribute("style")?.includes("none") === true,
    );
    await page.click(".lintel-intro__skip");
    await waitFor(page, () => document.querySelector(".lintel-intro") === null, 2000);
    await page.click("a");
    await page.waitForURL("**/next");
    await waitFor(page, () => document.querySelector(".lintel-intro") === null, 2000);
    await page.close();
  });

  it("covers the page and navigates where view transitions aren't available", async () => {
    const site = {
      ...off,
      pageTransition: { style: "fade", duration: 200 },
      intro: { style: "none", text: "", background: "#000000", colour: "#ffffff" },
    };
    const { page } = await openEffectsPage(browser, `<a href="/next">Next</a>`, [], {
      site,
      withoutViewTransitions: true,
      pages: { "/next": effectsDocument("<p>Arrived</p>", [], { site }) },
    });
    await page.waitForTimeout(300);
    await page.click("a");
    await page.waitForURL("**/next");
    expect(await page.textContent("p")).toBe("Arrived");
    await page.close();
  });
});
