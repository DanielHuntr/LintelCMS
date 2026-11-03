import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser } from "./harness.js";
import { openEffectsPage, waitFor, type OpenOptions } from "./effects-harness.js";

/**
 * Smooth scrolling, the site cursor's word and the hover picture, played by the built site
 * runtime and modules as a published page would (run `pnpm build` first).
 */

let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

const off = {
  pageTransition: { style: "none", duration: 400 },
  cursor: { style: "none", trail: "none", colour: "text", size: 32 },
  intro: { style: "none", text: "", background: "#000000", colour: "#ffffff" },
  smoothScroll: { strength: "off" },
};

const longPage = `
  <header style="position:sticky;top:0;height:60px;background:#eee" id="bar">Bar</header>
  <div style="height:900px"></div>
  <div id="inner" style="height:200px;overflow:auto"><div style="height:2000px">Inner list</div></div>
  <div style="height:1500px"></div>
  <h2 id="far">Far down</h2>
  <div style="height:3000px"></div>`;

const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

async function smoothPage(strength: "gentle" | "strong", options: OpenOptions = {}) {
  const { page } = await openEffectsPage(browser, longPage, [], {
    site: { ...off, smoothScroll: { strength } },
    ...options,
  });
  if (options.reducedMotion !== "reduce") {
    await waitFor(page, () => document.documentElement.dataset.lintelSmoothScroll !== undefined);
  }
  await page.mouse.move(400, 100);
  return page;
}

describe("smooth scrolling", () => {
  it("turns a wheel step into a glide that moves the page's real scroll position", async () => {
    const page = await smoothPage("gentle");
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(40);
    const early = await scrollY(page);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(400);
    await waitFor(page, () => Math.abs(window.scrollY - 400) < 1);
    expect(await page.evaluate(() => document.documentElement.scrollTop)).toBeCloseTo(400, 0);
    // Sticky still sticks, because the page really scrolled.
    expect(await page.$eval("#bar", (bar) => bar.getBoundingClientRect().top)).toBe(0);
    await page.close();
  });

  it("glides for longer when strong", async () => {
    const timeToArrive = async (strength: "gentle" | "strong") => {
      const page = await smoothPage(strength);
      await page.mouse.wheel(0, 600);
      const started = Date.now();
      await waitFor(page, () => Math.abs(window.scrollY - 600) < 1);
      const took = Date.now() - started;
      await page.close();
      return took;
    };
    expect(await timeToArrive("strong")).toBeGreaterThan(await timeToArrive("gentle"));
  });

  it("lets keys, links to part of the page and the page's own jumps work as usual", async () => {
    const page = await smoothPage("strong");
    await page.mouse.wheel(0, 300);
    await page.keyboard.press("End");
    await waitFor(
      page,
      () =>
        Math.abs(
          window.scrollY -
            (document.documentElement.scrollHeight - document.documentElement.clientHeight),
        ) < 2,
    );
    await page.evaluate(() => {
      location.hash = "far";
    });
    await waitFor(
      page,
      () => Math.abs(document.getElementById("far")!.getBoundingClientRect().top) < 2,
    );
    await page.waitForTimeout(200);
    expect(
      await page.$eval("#far", (heading) => Math.abs(heading.getBoundingClientRect().top)),
    ).toBeLessThan(1);
    await page.evaluate(() => window.scrollTo(0, 120));
    await page.waitForTimeout(100);
    await page.mouse.wheel(0, 100);
    await waitFor(page, () => Math.abs(window.scrollY - 220) < 1);
    await page.close();
  });

  it("leaves areas that scroll by themselves to the browser", async () => {
    const page = await smoothPage("gentle");
    await page.evaluate(() => window.scrollTo(0, 800));
    const inner = await page.$eval("#inner", (element) => {
      const box = element.getBoundingClientRect();
      return { x: box.left + 50, y: box.top + 50 };
    });
    await page.mouse.move(inner.x, inner.y);
    await page.mouse.wheel(0, 200);
    await waitFor(page, () => document.getElementById("inner")!.scrollTop > 0);
    expect(await scrollY(page)).toBe(800);
    await page.close();
  });

  it("is off for people who ask for less motion, and loads nothing", async () => {
    const { page, requested } = await openEffectsPage(browser, longPage, [], {
      site: { ...off, smoothScroll: { strength: "strong" } },
      reducedMotion: "reduce",
    });
    await page.waitForTimeout(300);
    expect(requested.some((path) => path.includes("smooth-scroll"))).toBe(false);
    expect(
      await page.evaluate(() => document.documentElement.dataset.lintelSmoothScroll),
    ).toBeUndefined();
    await page.close();
  });

  it("isn't loaded at all when the site has it off", async () => {
    const { page, requested } = await openEffectsPage(browser, longPage, [], { site: off });
    await page.waitForTimeout(300);
    expect(requested.some((path) => path.includes("smooth-scroll"))).toBe(false);
    await page.close();
  });

  it("is off on touch screens", async () => {
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
    const html = effectsDocument(longPage, [], {
      site: { ...off, smoothScroll: { strength: "gentle" } },
    });
    await page.route("http://touch.test/**", (route) =>
      route.fulfill({ contentType: "text/html", body: html }),
    );
    await page.goto("http://touch.test/");
    await page.waitForTimeout(300);
    expect(
      await page.evaluate(() => document.documentElement.dataset.lintelSmoothScroll),
    ).toBeUndefined();
    await context.close();
  });
});

describe("the site cursor", () => {
  const withCursor = (style: string, extra: Record<string, unknown> = {}) => ({
    ...off,
    cursor: { style, trail: "none", colour: "text", size: 32, ...extra },
  });
  const css =
    ":root{--lintel-color-text:rgb(10, 20, 30);--lintel-color-background:rgb(250, 250, 250)}";

  it("takes its colour from the theme, and grows over links", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<a href="#" style="display:block;margin-top:300px;width:200px">A link</a>`,
      [],
      { site: withCursor("ring"), css },
    );
    await page.mouse.move(100, 100);
    await waitFor(page, () => document.querySelector(".lintel-cursor") !== null);
    await page.mouse.move(110, 110);
    const ring = ".lintel-cursor";
    expect(await page.$eval(ring, (node) => getComputedStyle(node).borderTopColor)).toBe(
      "rgb(10, 20, 30)",
    );
    const sizeBefore = await page.$eval(ring, (node) => (node as HTMLElement).style.width);
    await page.mouse.move(50, 310);
    await waitFor(
      page,
      () => (document.querySelector(".lintel-cursor") as HTMLElement).style.width === "57.6px",
    );
    expect(sizeBefore).toBe("32px");
    await page.close();
  });

  it("shows the word set on an element, in place of the ring", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div data-node-id="card" style="margin-top:200px;height:200px">Project</div>`,
      [{ nodeId: "card", module: "cursor", behaviour: "cursorWord", params: { text: "View" } }],
      { site: withCursor("ring-and-dot"), css },
    );
    await page.mouse.move(100, 50);
    await waitFor(page, () => document.querySelectorAll(".lintel-cursor").length === 2);
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-word]") !== null);
    await page.mouse.move(100, 300);
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    const label = await page.$eval(".lintel-cursor-label[data-shown]", (node) => ({
      text: node.textContent,
      hidden: node.getAttribute("aria-hidden"),
      background: getComputedStyle(node).backgroundColor,
    }));
    expect(label).toEqual({ text: "View", hidden: "true", background: "rgb(10, 20, 30)" });
    expect(await page.$$eval(".lintel-cursor[data-hidden]", (nodes) => nodes.length)).toBe(2);
    // Only one word shows: the element's own label stands back for the site cursor.
    expect(await page.$$eval(".lintel-cursor-label[data-shown]", (nodes) => nodes.length)).toBe(1);
    await page.mouse.move(100, 50);
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") === null);
    await page.close();
  });

  it("shows the word on its own when the site has no custom cursor", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div data-node-id="card" style="height:200px">Project</div>`,
      [{ nodeId: "card", module: "cursor", behaviour: "cursorWord", params: { text: "Drag" } }],
      { site: off, css },
    );
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-word]") !== null);
    await page.mouse.move(100, 100);
    await page.mouse.move(110, 110);
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    expect(await page.textContent(".lintel-cursor-label[data-shown]")).toBe("Drag");
    await page.close();
  });

  it("follows the pointer exactly, without easing, for less motion", async () => {
    const { page } = await openEffectsPage(browser, `<p>Hello</p>`, [], {
      site: withCursor("ring"),
      reducedMotion: "reduce",
    });
    await page.mouse.move(100, 100);
    await waitFor(page, () => document.querySelector(".lintel-cursor") !== null);
    await page.mouse.move(300, 250);
    await page.waitForTimeout(50);
    expect(
      await page.$eval(".lintel-cursor", (node) => {
        const box = node.getBoundingClientRect();
        return {
          centre: [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)],
          transition: getComputedStyle(node).transitionDuration,
        };
      }),
    ).toEqual({ centre: [300, 250], transition: "0s" });
    await page.close();
  });

  // Shrinking on a click once scaled the ring's position too, so far from the window's corner
  // it jumped a long way from the pointer.
  it("stays on the pointer while pressed, wherever the pointer is", async () => {
    const { page } = await openEffectsPage(browser, `<p>Hello</p>`, [], {
      site: withCursor("ring"),
      reducedMotion: "reduce",
    });
    await page.mouse.move(100, 100);
    await waitFor(page, () => document.querySelector(".lintel-cursor") !== null);
    await page.mouse.move(700, 500);
    await page.waitForTimeout(50);
    const centre = () =>
      page.$eval(".lintel-cursor", (node) => {
        const box = node.getBoundingClientRect();
        return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
      });
    expect(await centre()).toEqual({ x: 700, y: 500 });
    await page.mouse.down();
    await page.waitForTimeout(50);
    expect(await page.$eval(".lintel-cursor", (node) => (node as HTMLElement).style.scale)).toBe(
      "0.85",
    );
    expect(await centre()).toEqual({ x: 700, y: 500 });
    await page.mouse.up();
    await page.close();
  });
});

describe("the hover picture", () => {
  it("appears and follows the pointer over its element, without getting in the way of clicks", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<a data-node-id="row" href="#clicked" style="display:block;height:80px;margin-top:100px">Project one</a>
       <a data-node-id="other" href="#" style="display:block;height:80px">Project two</a>`,
      [
        {
          nodeId: "row",
          module: "pointer",
          behaviour: "hoverPicture",
          params: { src: "/cake.svg" },
        },
      ],
      {
        pages: { "/cake.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"/>' },
      },
    );
    await page.mouse.move(10, 10);
    await waitFor(page, () => document.querySelector(".lintel-hover-picture") !== null);
    await page.mouse.move(100, 130);
    await page.mouse.move(120, 140);
    await waitFor(page, () => document.querySelector(".lintel-hover-picture[data-shown]") !== null);
    const layer = await page.$eval(".lintel-hover-picture", (node) => ({
      hidden: node.getAttribute("aria-hidden"),
      pointerEvents: getComputedStyle(node).pointerEvents,
      alt: node.querySelector("img")?.getAttribute("alt"),
      src: node.querySelector("img")?.getAttribute("src"),
    }));
    expect(layer).toEqual({ hidden: "true", pointerEvents: "none", alt: "", src: "/cake.svg" });
    await page.mouse.click(120, 140);
    await waitFor(page, () => location.hash === "#clicked");
    await page.mouse.move(120, 220);
    await waitFor(page, () => document.querySelector(".lintel-hover-picture[data-shown]") === null);
    await page.close();
  });
});

/*
 * A video from YouTube or Vimeo plays in an iframe, which keeps the pointer's events to
 * itself: the page stops hearing where the pointer is the moment it crosses onto the
 * video. The cursor, its word and any hover picture once froze there, on top of the
 * player's own controls.
 */
describe("over an embedded video", () => {
  const frame = `<!doctype html><html><body style="margin:0;background:#222;height:100vh"></body></html>`;
  // A frame on the video element, with a 40px margin of the element around it.
  const video = `<figure data-node-id="video" style="margin:100px 0 0;padding:40px;width:600px;height:340px;box-sizing:border-box;background:#ccc">
    <iframe src="/frame" title="Video" style="display:block;width:100%;height:100%;border:0"></iframe>
  </figure><div style="height:800px"></div>`;
  const pages = { "/frame": frame };
  const css =
    ":root{--lintel-color-text:rgb(10, 20, 30);--lintel-color-background:rgb(250, 250, 250)}";
  const shownWords = (page: Page) =>
    page.$$eval(".lintel-cursor-label[data-shown]", (nodes) => nodes.length);
  const cursorOpacity = (page: Page) =>
    page.$$eval(".lintel-cursor", (nodes) =>
      nodes.map((node) => getComputedStyle(node).opacity).join(","),
    );

  it("hides the site cursor and its word over the frame, and brings them back after", async () => {
    const { page } = await openEffectsPage(
      browser,
      video,
      [{ nodeId: "video", module: "cursor", behaviour: "cursorWord", params: { text: "Play" } }],
      {
        site: {
          ...off,
          cursor: { style: "ring-and-dot", trail: "none", colour: "text", size: 32 },
        },
        css,
        pages,
      },
    );
    await page.mouse.move(300, 20);
    await waitFor(page, () => document.querySelectorAll(".lintel-cursor").length === 2);
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-word]") !== null);
    // On the element, beside the frame: the word shows.
    await page.mouse.move(300, 120, { steps: 4 });
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    // Onto the video itself: nothing of ours is left on top of it.
    await page.mouse.move(300, 270, { steps: 6 });
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") === null);
    await page.waitForTimeout(300);
    expect(await shownWords(page)).toBe(0);
    expect(await cursorOpacity(page)).toBe("0,0");
    // Back off the video: the word returns, and then the cursor once off the element.
    await page.mouse.move(300, 120, { steps: 6 });
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    await page.mouse.move(300, 20, { steps: 4 });
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") === null);
    await page.waitForTimeout(300);
    expect(await cursorOpacity(page)).toBe("1,1");
    await page.close();
  });

  it("hides the word on its own over the frame when there's no site cursor", async () => {
    const { page } = await openEffectsPage(
      browser,
      video,
      [{ nodeId: "video", module: "cursor", behaviour: "cursorWord", params: { text: "Play" } }],
      { site: off, css, pages },
    );
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-word]") !== null);
    await page.mouse.move(300, 20);
    await page.mouse.move(300, 120, { steps: 4 });
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    await page.mouse.move(300, 270, { steps: 6 });
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") === null);
    await page.mouse.move(300, 120, { steps: 6 });
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    await page.close();
  });

  it("doesn't show the word when the pointer lands straight on the frame", async () => {
    const { page } = await openEffectsPage(
      browser,
      video,
      [{ nodeId: "video", module: "cursor", behaviour: "cursorWord", params: { text: "Play" } }],
      { site: off, css, pages },
    );
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-word]") !== null);
    await page.mouse.move(300, 20);
    await page.mouse.move(300, 270);
    await page.waitForTimeout(300);
    expect(await shownWords(page)).toBe(0);
    await page.close();
  });

  it("hides a hover picture over the frame", async () => {
    const { page } = await openEffectsPage(
      browser,
      video,
      [
        {
          nodeId: "video",
          module: "pointer",
          behaviour: "hoverPicture",
          params: { src: "/cake.svg" },
        },
      ],
      {
        pages: {
          ...pages,
          "/cake.svg": '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"/>',
        },
      },
    );
    await page.mouse.move(300, 20);
    await waitFor(page, () => document.querySelector(".lintel-hover-picture") !== null);
    await page.mouse.move(300, 120, { steps: 4 });
    await waitFor(page, () => document.querySelector(".lintel-hover-picture[data-shown]") !== null);
    await page.mouse.move(300, 270, { steps: 6 });
    await waitFor(page, () => document.querySelector(".lintel-hover-picture[data-shown]") === null);
    await page.mouse.move(300, 120, { steps: 6 });
    await waitFor(page, () => document.querySelector(".lintel-hover-picture[data-shown]") !== null);
    await page.close();
  });

  it("shows the word over a video file, and clicks still reach the player", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<figure data-node-id="video" style="margin:100px 0 0;width:600px"><video controls style="display:block;width:600px;height:340px;background:#222"></video></figure>
       <button id="load" style="margin-top:20px" onclick="this.dataset.pressed=''">Load video</button>`,
      [{ nodeId: "video", module: "cursor", behaviour: "cursorWord", params: { text: "Play" } }],
      {
        site: {
          ...off,
          cursor: { style: "ring-and-dot", trail: "none", colour: "text", size: 32 },
        },
        css,
      },
    );
    await page.mouse.move(300, 20);
    await waitFor(page, () => document.querySelector("[data-lintel-cursor-word]") !== null);
    await page.mouse.move(300, 270, { steps: 4 });
    await waitFor(page, () => document.querySelector(".lintel-cursor-label[data-shown]") !== null);
    expect(await page.evaluate(() => document.elementFromPoint(300, 270)?.tagName)).toBe("VIDEO");
    expect(
      await page.$eval(".lintel-cursor-label", (node) => getComputedStyle(node).pointerEvents),
    ).toBe("none");
    await page.close();
  });
});
