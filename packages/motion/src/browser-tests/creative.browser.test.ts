import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser } from "./harness.js";
import { openEffectsPage, waitFor } from "./effects-harness.js";

/**
 * The creative pack, played by the real site runtime and modules: the drag-and-throw
 * playground, the Lottie element and the Rive element (with Lintel's own samples).
 */

let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

const sticker = (id: string, words: string) =>
  `<div id="${id}" style="width:120px;height:60px;background:#eee;border-radius:30px">${words}</div>`;
const playgroundHtml = `<section data-node-id="play" style="display:flex;gap:16px;align-items:flex-start;height:400px;width:800px;padding:0">${sticker("one", "Hello")}${sticker("two", "There")}${sticker("three", "Friend")}</section><div style="height:1500px"></div>`;
const playground = (params: Record<string, string | boolean> = {}) => [
  { nodeId: "play", module: "playground", behaviour: "dragPlayground", params },
];
const offset = (page: Page, selector: string) =>
  page.$eval(selector, (element) => (element as HTMLElement).style.translate);
const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("drag and throw these", () => {
  it("lets a visitor throw an item, which glides on and stays inside its container", async () => {
    const { page } = await openEffectsPage(browser, playgroundHtml, playground());
    await waitFor(page, () => document.querySelector<HTMLElement>("#one")?.tabIndex === 0);
    const box = (await page.locator("#one").boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.mouse.down();
    for (let step = 1; step <= 6; step += 1) {
      await page.mouse.move(box.x + 20 + step * 30, box.y + 20 + step * 20);
      await pause(16);
    }
    await page.mouse.up();
    await pause(900);
    const moved = (await page.locator("#one").boundingBox())!;
    const container = (await page.locator("section").boundingBox())!;
    expect(moved.x).toBeGreaterThan(box.x + 180);
    expect(moved.x + moved.width).toBeLessThanOrEqual(container.x + container.width + 1);
    expect(moved.y + moved.height).toBeLessThanOrEqual(container.y + container.height + 1);
    // The Tidy up button appears once something has moved, and puts everything back.
    await page.getByRole("button", { name: "Tidy up" }).click();
    await pause(900);
    expect(["", "0px", "0px 0px"]).toContain(await offset(page, "#one"));
    await page.close();
  });

  it("moves the focused item with the arrow keys, further with Shift", async () => {
    const { page } = await openEffectsPage(browser, playgroundHtml, playground());
    await waitFor(page, () => document.querySelector<HTMLElement>("#two")?.tabIndex === 0);
    expect(
      await page.$eval("#two", (element) => element.getAttribute("aria-roledescription")),
    ).toBe("draggable");
    await page.focus("#two");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Shift+ArrowDown");
    await pause(200);
    expect(await offset(page, "#two")).toBe("0px 120px");
    await page.close();
  });

  it("lets things fall into a pile at the bottom when asked", async () => {
    const { page } = await openEffectsPage(browser, playgroundHtml, playground({ feel: "fall" }));
    await pause(1500);
    const container = (await page.locator("section").boundingBox())!;
    const fallen = (await page.locator("#three").boundingBox())!;
    expect(container.y + container.height - (fallen.y + fallen.height)).toBeLessThan(4);
    await page.close();
  });

  it("leaves the page scrolling when a finger swipes on the container's empty space", async () => {
    const { page } = await openEffectsPage(browser, playgroundHtml, playground(), { touch: true });
    await waitFor(page, () => document.querySelector<HTMLElement>("#one")?.tabIndex === 0);
    expect(await page.$eval("section", (element) => getComputedStyle(element).touchAction)).toBe(
      "auto",
    );
    expect(await page.$eval("#one", (element) => getComputedStyle(element).touchAction)).toBe(
      "none",
    );
    await page.close();
  });

  it("scrolls under a real finger on empty space, and drags under one on a sticker", async () => {
    const { page } = await openEffectsPage(browser, playgroundHtml, playground(), { touch: true });
    await waitFor(page, () => document.querySelector<HTMLElement>("#one")?.tabIndex === 0);
    const client = await page.context().newCDPSession(page);
    const swipe = async (x: number, y: number) => {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let step = 1; step <= 12; step += 1) {
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y - step * 10 }],
        });
        await pause(16);
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await pause(300);
    };
    const scrolled = () => page.evaluate(() => window.scrollY);
    const sticker = (await page.locator("#one").boundingBox())!;
    await swipe(sticker.x + 40, sticker.y + 30);
    expect(await scrolled()).toBe(0);
    await swipe(600, 300);
    expect(await scrolled()).toBeGreaterThan(50);
    await page.close();
  });

  it("keeps the designed layout, untouched, for people who ask for less motion", async () => {
    const { page } = await openEffectsPage(browser, playgroundHtml, playground(), {
      reducedMotion: "reduce",
    });
    await pause(600);
    expect(await page.$eval("#one", (element) => element.hasAttribute("tabindex"))).toBe(false);
    expect(await page.locator("button").count()).toBe(0);
    await page.close();
  });
});

const lottieHtml = (poster = "") =>
  `<div data-node-id="lottie" role="img" aria-label="Three dots hopping" style="width:200px;height:200px;position:relative">${poster}</div><div style="height:2000px"></div>`;
const lottie = (params: Record<string, string | boolean> = {}) => [
  { nodeId: "lottie", module: "lottie", behaviour: "lottiePlayer", params },
];
const posterImage = `<img class="lintel-animation__poster" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" style="width:200px;height:200px">`;

/** A .lottie file (a zip) holding the sample animation, written here byte by byte. */
function dotLottie(): Buffer {
  const animation = readFileSync(
    fileURLToPath(new URL("../../samples/sample-hop.json", import.meta.url)),
  );
  const files: Array<[string, Buffer]> = [
    ["manifest.json", Buffer.from(JSON.stringify({ animations: [{ id: "hop" }] }))],
    ["animations/hop.json", animation],
  ];
  const locals: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [name, contents] of files) {
    const packed = deflateRawSync(contents);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(contents.length, 22);
    local.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(contents.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    const part = Buffer.concat([local, Buffer.from(name), packed]);
    locals.push(part);
    directory.push(Buffer.concat([entry, Buffer.from(name)]));
    offset += part.length;
  }
  const directoryBytes = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directoryBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directoryBytes, end]);
}

const drawnFrame = (page: Page) =>
  page.$eval("[data-node-id=lottie] svg", (svg) => svg.innerHTML.length);

describe("the Lottie element", () => {
  it("plays Lintel's sample when it has no file yet, swapping the poster for the animation", async () => {
    const { page, requested } = await openEffectsPage(browser, lottieHtml(posterImage), lottie());
    await waitFor(page, () => document.querySelector("[data-node-id=lottie] svg") !== null);
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=lottie][data-playing]") !== null,
    );
    expect(
      await page.$eval(".lintel-animation__poster", (poster) => (poster as HTMLElement).hidden),
    ).toBe(true);
    expect(requested.some((path) => /sample-hop-\w+\.json$/.test(path))).toBe(true);
    expect(requested.some((path) => /lottie-player-\w+\.js$/.test(path))).toBe(true);
    // The animation is hidden from screen readers; the element's own label speaks for it.
    expect(
      await page.$eval(".lintel-animation__stage", (stage) => stage.getAttribute("aria-hidden")),
    ).toBe("true");
    const transform = () =>
      page.$eval("[data-node-id=lottie] svg g g", (group) => group.getAttribute("transform"));
    const first = await transform();
    await pause(300);
    expect(await transform()).not.toBe(first);
    await page.close();
  });

  it("reads a .lottie file from the media library", async () => {
    const { page } = await openEffectsPage(
      browser,
      lottieHtml(),
      lottie({ src: "/media/hop.lottie" }),
      {
        files: { "/media/hop.lottie": { type: "application/zip", body: dotLottie() } },
      },
    );
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=lottie][data-playing]") !== null,
    );
    expect(await drawnFrame(page)).toBeGreaterThan(100);
    await page.close();
  });

  it("follows the scroll when set to play as visitors scroll", async () => {
    const { page } = await openEffectsPage(
      browser,
      `<div style="height:300px"></div>${lottieHtml()}`,
      lottie({ play: "scroll" }),
    );
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=lottie][data-playing]") !== null,
    );
    const transform = () =>
      page.$eval("[data-node-id=lottie] svg g g", (group) => group.getAttribute("transform"));
    const before = await transform();
    await pause(300);
    expect(await transform()).toBe(before);
    await page.mouse.wheel(0, 200);
    await pause(300);
    expect(await transform()).not.toBe(before);
    await page.close();
  });

  it("plays forwards under the pointer and back again when it leaves", async () => {
    const { page } = await openEffectsPage(browser, lottieHtml(), lottie({ play: "hover" }));
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=lottie][data-playing]") !== null,
    );
    const transform = () =>
      page.$eval("[data-node-id=lottie] svg g g", (group) => group.getAttribute("transform"));
    const resting = await transform();
    await pause(300);
    expect(await transform()).toBe(resting);
    await page.hover("[data-node-id=lottie]");
    await pause(400);
    expect(await transform()).not.toBe(resting);
    await page.mouse.move(800, 600);
    await pause(1200);
    expect(await transform()).toBe(resting);
    await page.close();
  });

  it("keeps the poster, and loads nothing, for people who ask for less motion", async () => {
    const { page, requested } = await openEffectsPage(browser, lottieHtml(posterImage), lottie(), {
      reducedMotion: "reduce",
    });
    await pause(800);
    expect(
      await page.$eval(".lintel-animation__poster", (poster) => (poster as HTMLElement).hidden),
    ).toBe(false);
    expect(requested.some((path) => path.includes("lottie-player"))).toBe(false);
    await page.close();
  });

  it("shows one still frame for less motion when there is no poster", async () => {
    const { page } = await openEffectsPage(browser, lottieHtml(), lottie(), {
      reducedMotion: "reduce",
    });
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=lottie][data-playing]") !== null,
    );
    const transform = () =>
      page.$eval("[data-node-id=lottie] svg g g", (group) => group.getAttribute("transform"));
    const still = await transform();
    await pause(300);
    expect(await transform()).toBe(still);
    await page.close();
  });
});

const riveHtml = `<div data-node-id="rive" role="img" aria-label="A dot circling" style="width:200px;height:200px;position:relative"></div>`;
const rive = (params: Record<string, string | boolean> = {}) => [
  { nodeId: "rive", module: "rive", behaviour: "rivePlayer", params },
];

/** A fingerprint of what the canvas shows now. */
const canvasPicture = (page: Page) =>
  page.$eval("[data-node-id=rive] canvas", (canvas) =>
    (canvas as HTMLCanvasElement).toDataURL().slice(-200),
  );

describe("the Rive element", () => {
  it("plays Lintel's sample with Rive's runtime and WebAssembly, all from this site", async () => {
    const { page, requested } = await openEffectsPage(browser, riveHtml, rive());
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=rive][data-playing]") !== null,
      10_000,
    );
    const first = await canvasPicture(page);
    await pause(400);
    expect(await canvasPicture(page)).not.toBe(first);
    expect(requested.some((path) => /rive-\w+\.wasm$/.test(path))).toBe(true);
    expect(requested.some((path) => /sample-orbit-\w+\.riv$/.test(path))).toBe(true);
    await page.close();
  });

  it("flips its switch by click and by keyboard when it responds to a click", async () => {
    const pressable = riveHtml.replace('role="img"', 'role="button" tabindex="0"');
    const { page } = await openEffectsPage(browser, pressable, rive({ respondTo: "click" }));
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=rive][data-playing]") !== null,
      10_000,
    );
    const pressed = () =>
      page.$eval("[data-node-id=rive]", (element) => element.getAttribute("aria-pressed"));
    await page.click("[data-node-id=rive]");
    expect(await pressed()).toBe("true");
    await page.focus("[data-node-id=rive]");
    await page.keyboard.press("Enter");
    expect(await pressed()).toBe("false");
    await page.keyboard.press("Space");
    expect(await pressed()).toBe("true");
    await page.close();
  });

  it("holds one drawn frame for less motion when there is no poster", async () => {
    const { page } = await openEffectsPage(browser, riveHtml, rive(), { reducedMotion: "reduce" });
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=rive][data-playing]") !== null,
      10_000,
    );
    await pause(300);
    const painted = await page.$eval("[data-node-id=rive] canvas", (element) => {
      const canvas = element as HTMLCanvasElement;
      const pixels = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      let count = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index]! > 0) count += 1;
      return count;
    });
    expect(painted).toBeGreaterThan(1000);
    const picture = await canvasPicture(page);
    await pause(400);
    expect(await canvasPicture(page)).toBe(picture);
    await page.close();
  });

  it("keeps the poster, and loads no runtime, for less motion", async () => {
    const { page, requested } = await openEffectsPage(
      browser,
      riveHtml.replace("</div>", `${posterImage}</div>`),
      rive(),
      { reducedMotion: "reduce" },
    );
    await pause(800);
    expect(requested.some((path) => path.includes("rive-player"))).toBe(false);
    expect(await page.locator(".lintel-animation__poster").isVisible()).toBe(true);
    await page.close();
  });

  it("switches the state machine's input on while the pointer is over it", async () => {
    const { page } = await openEffectsPage(browser, riveHtml, rive({ respondTo: "hover" }));
    await waitFor(
      page,
      () => document.querySelector("[data-node-id=rive][data-playing]") !== null,
      10_000,
    );
    const coloured = () =>
      page.$eval("[data-node-id=rive] canvas", (element) => {
        const canvas = element as HTMLCanvasElement;
        const pixels = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let index = 3; index < pixels.length; index += 4) if (pixels[index]! > 0) count += 1;
        return count;
      });
    /** Several looks over a while, because the sample swells gently as it idles. */
    const samples = async () => {
      const seen: number[] = [];
      for (let look = 0; look < 8; look += 1) {
        seen.push(await coloured());
        await pause(120);
      }
      return seen;
    };
    await page.mouse.move(800, 600);
    const idle = Math.max(...(await samples()));
    await page.hover("[data-node-id=rive]");
    await pause(600);
    // The sample's hover state is always bigger than its idle state ever gets.
    const hovered = Math.min(...(await samples()));
    expect(hovered).toBeGreaterThan(idle);
    await page.mouse.move(800, 600);
    await pause(700);
    expect(Math.max(...(await samples()))).toBeLessThan(hovered);
    await page.close();
  });
});
