import type { Browser, Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { launchBrowser } from "./harness.js";
import { openEffectsPage, type EffectOnTest } from "./effects-harness.js";

/**
 * The performance budget: a page busy with effects keeps close to 60 frames a second while
 * scrolling, with no task longer than 50 ms, on a "mid laptop": Chromium with its CPU
 * slowed to half speed. Numbers are printed so changes can be compared.
 */

let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

const card = (id: string) =>
  `<div data-node-id="${id}" style="width:280px;height:160px;margin:40px;background:#eee;border-radius:16px">Card</div>`;

function busyPage(): { html: string; effects: EffectOnTest[] } {
  const effects: EffectOnTest[] = [];
  let html = `<section data-node-id="bg" style="height:500px;position:relative"><h1 data-node-id="title">Fresh bread, every morning</h1></section>`;
  effects.push({ nodeId: "bg", module: "particles", behaviour: "particleField" });
  effects.push({ nodeId: "title", module: "text", behaviour: "scramble" });
  html += `<div data-node-id="row"><span>Bread</span><span>Cakes</span><span>Coffee</span><span>Pastries</span></div>`;
  effects.push({ nodeId: "row", module: "marquee", behaviour: "velocityMarquee" });
  for (let index = 0; index < 12; index += 1) {
    const id = `card${index}`;
    html += card(id);
    const kinds: EffectOnTest[] = [
      { nodeId: id, module: "pointer", behaviour: "tilt", params: { glare: true } },
      { nodeId: id, module: "scroll", behaviour: "velocitySkew" },
      { nodeId: id, module: "scroll", behaviour: "scrollParallax" },
      { nodeId: id, module: "pointer", behaviour: "spotlight" },
    ];
    effects.push(kinds[index % kinds.length]!);
  }
  html += `<div data-node-id="line"><svg width="600" height="40"><path d="M0 20 C150 0 450 40 600 20" stroke="black" fill="none"/></svg></div><div style="height:2000px"></div>`;
  effects.push({ nodeId: "line", module: "scroll", behaviour: "pathDraw" });
  return { html, effects };
}

async function measureScroll(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setCPUThrottlingRate", { rate: 2 });
  await page.evaluate(() => {
    const record = { frames: [] as number[], longTasks: [] as number[] };
    (window as Window & { perf?: typeof record }).perf = record;
    new PerformanceObserver((list) =>
      list.getEntries().forEach((entry) => record.longTasks.push(entry.duration)),
    ).observe({ type: "longtask", buffered: false });
    let last = performance.now();
    const tick = (now: number) => {
      record.frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(300, 300);
  for (let step = 0; step < 90; step += 1) {
    await page.mouse.wheel(0, 40);
    if (step % 10 === 0) await page.mouse.move(200 + step * 3, 300 + (step % 20) * 4);
    await page.waitForTimeout(16);
  }
  const result = await page.evaluate(
    () => (window as Window & { perf?: { frames: number[]; longTasks: number[] } }).perf!,
  );
  await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const frames = result.frames.slice(5);
  const average = frames.reduce((total, frame) => total + frame, 0) / Math.max(1, frames.length);
  const sorted = [...frames].sort((a, b) => a - b);
  return {
    fps: 1000 / average,
    slowestFrame: sorted.at(-1) ?? 0,
    ninetyFifth: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    longestTask: Math.max(0, ...result.longTasks),
  };
}

describe("effects performance", () => {
  it("keeps a busy page smooth while scrolling, with no long tasks", async () => {
    const { html, effects } = busyPage();
    const { page } = await openEffectsPage(browser, html, effects);
    await page.waitForTimeout(800);
    const measured = await measureScroll(page);
    console.warn(
      `Busy page while scrolling (CPU at half speed): ${measured.fps.toFixed(1)} fps, 95th percentile frame ${measured.ninetyFifth.toFixed(1)} ms, longest task ${measured.longestTask.toFixed(0)} ms`,
    );
    expect(measured.longestTask).toBeLessThanOrEqual(50);
    expect(measured.fps).toBeGreaterThan(50);
    await page.close();
  }, 60_000);

  it("keeps a WebGL background from blocking the page while scrolling", async () => {
    const html = `<section data-node-id="liquid" style="height:600px"></section><div style="height:3000px"></div>`;
    const { page } = await openEffectsPage(browser, html, [
      { nodeId: "liquid", module: "liquid-gradient", behaviour: "liquidGradient" },
    ]);
    await page.waitForTimeout(800);
    const measured = await measureScroll(page);
    console.warn(
      `WebGL liquid gradient while scrolling (CPU at half speed): ${measured.fps.toFixed(1)} fps, longest task ${measured.longestTask.toFixed(0)} ms`,
    );
    expect(measured.longestTask).toBeLessThanOrEqual(50);
    await page.close();
  }, 60_000);

  it("does no work at all when nothing moves", async () => {
    const { html, effects } = busyPage();
    const filtered = effects.filter(
      (effect) => effect.module !== "particles" && effect.module !== "marquee",
    );
    const { page } = await openEffectsPage(browser, html, filtered);
    await page.waitForTimeout(1500);
    const callbacks = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let count = 0;
          const original = window.requestAnimationFrame.bind(window);
          window.requestAnimationFrame = (callback) => {
            count += 1;
            return original(callback);
          };
          setTimeout(() => resolve(count), 500);
        }),
    );
    expect(callbacks).toBe(0);
    await page.close();
  });
});
