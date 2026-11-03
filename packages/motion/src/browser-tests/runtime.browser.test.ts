import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser, nextFrames, openPage } from "./harness.js";

// Undefined only if Chromium failed to start, which beforeAll reports.
let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

const style = (page: Page, selector: string, property: string) =>
  page.$eval(
    selector,
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property,
  );

describe("playing presets in a real browser", () => {
  it("plays a load animation to its end", async () => {
    const page = await openPage(browser, `<div id="box" data-motion-cloak>Hello</div>`);
    await page.evaluate(async () => {
      const spec = { ...window.presets.findPreset("page-rise-in")!.spec, duration: 120 };
      await window.motion.mountMotion(document.getElementById("box")!, spec).finished();
    });
    expect(await style(page, "#box", "opacity")).toBe("1");
    expect(await style(page, "#box", "translate")).toBe("0px");
    expect(await page.$eval("#box", (element) => element.hasAttribute("data-motion-cloak"))).toBe(
      false,
    );
  });

  it("shows any moment of an animation when seeked", async () => {
    const page = await openPage(browser, `<div id="box">Hello</div>`);
    await page.evaluate(() => {
      const spec = { ...window.presets.findPreset("fade-up")!.spec, easing: "linear" as const };
      window.motion
        .mountMotion(document.getElementById("box")!, spec, { mode: "manual" })
        .seek(0.5);
    });
    expect(Number(await style(page, "#box", "opacity"))).toBeCloseTo(0.5, 2);
    expect(await style(page, "#box", "translate")).toBe("0px 16px");
  });

  it("waits out of view, then plays when scrolled to", async () => {
    const page = await openPage(
      browser,
      `<div style="height:1500px"></div><div id="card">Card</div><div style="height:800px"></div>`,
    );
    await page.evaluate(() => {
      const spec = { ...window.presets.findPreset("fade-up")!.spec, duration: 100 };
      window.motion.mountMotion(document.getElementById("card")!, spec);
    });
    await nextFrames(page);
    expect(await style(page, "#card", "opacity")).toBe("0");
    await page.evaluate(() => document.getElementById("card")!.scrollIntoView({ block: "center" }));
    await page.waitForFunction(
      () => getComputedStyle(document.getElementById("card")!).opacity === "1",
    );
  });

  // Chrome counts an element clipped to nothing as out of view, so "Mask reveal up", which
  // starts fully clipped, waited for a view it could never be in: the words stayed hidden.
  it("plays a reveal that starts fully clipped, once it's in view", async () => {
    const page = await openPage(
      browser,
      `<div style="height:1500px"></div><h2 id="title">Freedom</h2><div style="height:800px"></div>`,
    );
    await page.evaluate(() => {
      const spec = { ...window.presets.findPreset("mask-reveal-up")!.spec, duration: 100 };
      window.motion.mountMotion(document.getElementById("title")!, spec);
    });
    await nextFrames(page);
    expect(await style(page, "#title", "clip-path")).toBe("inset(100% 0% 0%)");
    await page.evaluate(() =>
      document.getElementById("title")!.scrollIntoView({ block: "center" }),
    );
    await page.waitForFunction(
      () => getComputedStyle(document.getElementById("title")!).clipPath.startsWith("inset(0%"),
      undefined,
      { timeout: 3000 },
    );
  });

  it("follows the scroll position with the browser's view timeline", async () => {
    const page = await openPage(
      browser,
      `<div style="height:600px"></div><div id="layer" style="height:200px">Layer</div><div style="height:1200px"></div>`,
    );
    const native = await page.evaluate(() => {
      window.motion.mountMotion(
        document.getElementById("layer")!,
        window.presets.findPreset("parallax-slow")!.spec,
      );
      return typeof ViewTimeline === "function";
    });
    expect(native).toBe(true);
    // The layer's top meets the bottom of the screen at 0 and leaves the top at 800: halfway is 400.
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForFunction(
      () => getComputedStyle(document.getElementById("layer")!).translate === "0px",
    );
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForFunction(
      () => getComputedStyle(document.getElementById("layer")!).translate === "0px 60px",
    );
  });

  it("scrubs staggered scenes itself, reading once and writing once per frame", async () => {
    const page = await openPage(
      browser,
      `<div style="height:600px"></div><ul id="list" style="height:200px"><li>A</li><li>B</li></ul><div style="height:1200px"></div>`,
    );
    await page.evaluate(() => {
      window.motion.mountMotion(document.getElementById("list")!, {
        ...window.presets.findPreset("scroll-fade-through")!.spec,
        targets: { type: "children" },
        stagger: { each: 300, from: "first" },
        duration: 600,
        tracks: [
          {
            property: "opacity",
            keyframes: [
              { offset: 0, value: 0 },
              { offset: 1, value: 1 },
            ],
          },
        ],
      });
    });
    await page.evaluate(() => window.scrollTo(0, 400));
    await nextFrames(page);
    // Halfway through a 900ms span: the first item is at 450ms of 600, the second at 150.
    expect(Number(await style(page, "li:nth-child(1)", "opacity"))).toBeCloseTo(0.75, 1);
    expect(Number(await style(page, "li:nth-child(2)", "opacity"))).toBeCloseTo(0.25, 1);
  });

  it("pins a sideways scrolling section and moves its row", async () => {
    const page = await openPage(
      browser,
      `<section id="scene"><div><div id="row" style="display:flex;width:400%"><p style="flex:1">1</p><p style="flex:1">2</p><p style="flex:1">3</p><p style="flex:1">4</p></div></div></section><div style="height:600px"></div>`,
    );
    await page.evaluate(() => {
      window.motion.mountMotion(
        document.getElementById("scene")!,
        window.presets.findPreset("horizontal-scroll")!.spec,
      );
    });
    expect(await page.$eval("#scene", (element) => element.getBoundingClientRect().height)).toBe(
      2400,
    );
    await page.evaluate(() => window.scrollTo(0, 900));
    await nextFrames(page);
    expect(
      await page.$eval("#row", (element) => element.parentElement!.getBoundingClientRect().top),
    ).toBe(0);
    await page.waitForFunction(
      () => getComputedStyle(document.getElementById("row")!).translate === "-37.5%",
    );
  });
});

describe("interaction triggers", () => {
  it("lifts on hover and settles back when the pointer leaves", async () => {
    const page = await openPage(
      browser,
      `<div id="card" style="width:200px;height:100px;margin:40px">Card</div>`,
    );
    await page.evaluate(() =>
      window.motion.mountMotion(
        document.getElementById("card")!,
        window.presets.findPreset("hover-lift")!.spec,
      ),
    );
    await page.hover("#card");
    await page.waitForFunction(
      () => getComputedStyle(document.getElementById("card")!).translate === "0px -6px",
    );
    await page.mouse.move(700, 500);
    await page.waitForFunction(
      () => getComputedStyle(document.getElementById("card")!).translate === "0px",
    );
  });

  it("tilts towards the pointer", async () => {
    const page = await openPage(
      browser,
      `<div id="card" style="width:200px;height:200px;margin:40px">Card</div>`,
    );
    await page.evaluate(() =>
      window.motion.mountMotion(
        document.getElementById("card")!,
        window.presets.findPreset("hover-tilt")!.spec,
      ),
    );
    await page.mouse.move(60, 60);
    await page.mouse.move(239, 140, { steps: 4 });
    await page.waitForFunction(() =>
      /rotateY\((?:[5-9]|10)\.?\d*deg\)/.test(document.getElementById("card")!.style.transform),
    );
  });

  it("plays on clicks and custom events, and waits for page exits", async () => {
    const page = await openPage(
      browser,
      `<button id="button">Buy</button><main id="page">Page</main>`,
    );
    const playing = await page.evaluate(async () => {
      const button = document.getElementById("button")!;
      const press = window.motion.mountMotion(button, window.presets.findPreset("press")!.spec);
      button.click();
      const afterClick = button.getAnimations()[0]?.playState;
      press.destroy();
      const pulse = window.motion.mountMotion(button, window.presets.findPreset("pulse")!.spec);
      document.dispatchEvent(new CustomEvent("motion:attention"));
      const afterEvent = button.getAnimations()[0]?.playState;
      pulse.destroy();
      const exit = { ...window.presets.findPreset("page-fade-out")!.spec, duration: 80 };
      await window.motion.mountMotion(document.getElementById("page")!, exit).exit();
      return {
        afterClick,
        afterEvent,
        opacity: getComputedStyle(document.getElementById("page")!).opacity,
      };
    });
    expect(playing).toEqual({ afterClick: "running", afterEvent: "running", opacity: "0" });
  });

  it("splits a heading into letters but keeps it readable to screen readers", async () => {
    const page = await openPage(browser, `<h1 id="title">Hi there</h1>`);
    await page.evaluate(() =>
      window.motion.mountMotion(
        document.getElementById("title")!,
        window.presets.findPreset("letters-fade")!.spec,
      ),
    );
    expect(await page.$$eval(".motion-letter", (letters) => letters.length)).toBe(7);
    const snapshot = await page.locator("#title").ariaSnapshot();
    expect(snapshot).toContain("Hi there");
  });
});

describe("reduced motion", () => {
  it("fades instead of moving when the device asks for less motion", async () => {
    const page = await openPage(browser, `<div id="box">Hello</div>`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const result = await page.evaluate(() => {
      const controller = window.motion.mountMotion(
        document.getElementById("box")!,
        window.presets.findPreset("fade-up")!.spec,
        { mode: "manual" },
      );
      controller.seek(0.5);
      return {
        reduced: controller.reduced,
        translate: getComputedStyle(document.getElementById("box")!).translate,
      };
    });
    expect(result).toEqual({ reduced: true, translate: "none" });
    expect(Number(await style(page, "#box", "opacity"))).toBeGreaterThan(0);
  });

  it("leaves decorative motion out entirely", async () => {
    const page = await openPage(browser, `<div id="box">Hello</div>`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const animations = await page.evaluate(() => {
      const box = document.getElementById("box")!;
      window.motion.mountMotion(box, window.presets.findPreset("parallax-slow")!.spec);
      return box.getAnimations().length;
    });
    expect(animations).toBe(0);
  });

  it("switches when the setting changes while the page is open", async () => {
    const page = await openPage(browser, `<div id="box">Hello</div>`);
    await page.evaluate(() => {
      Object.assign(window, {
        controller: window.motion.mountMotion(
          document.getElementById("box")!,
          window.presets.findPreset("hover-lift")!.spec,
        ),
      });
    });
    expect(await page.$eval("#box", (box) => box.getAnimations().length)).toBe(1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.getElementById("box")!.getAnimations().length === 0);
  });
});
