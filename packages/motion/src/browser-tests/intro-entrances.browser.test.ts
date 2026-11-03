import type { Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { introCss, introMarkup } from "../effects-catalogue/site-intro.js";
import type { SiteEffectSettings } from "../effects/effect-types.js";
import { findPreset } from "../presets/index.js";
import { openEffectsPage, waitFor } from "./effects-harness.js";
import { launchBrowser } from "./harness.js";

/**
 * The site intro and the page's own entrances, played by the built site runtime as a
 * published page would (run `pnpm build` first). Entrances used to finish underneath the
 * intro; now they wait for it to lift.
 */

let browser: Browser;

beforeAll(async () => {
  browser = await launchBrowser();
});

afterAll(async () => {
  await browser?.close();
});

const site: SiteEffectSettings = {
  pageTransition: { style: "none", duration: 400 },
  cursor: { style: "none", trail: "none", colour: "text", size: 32 },
  intro: { style: "counter", text: "", background: "#111111", colour: "#ffffff" },
  smoothScroll: { strength: "off" },
};

function pageWithEntrance(): string {
  const spec = { ...findPreset("page-rise-in")!.spec, duration: 2500 };
  const motion = JSON.stringify([{ nodeId: "title", spec }]).replace(/</g, "\\u003c");
  return `${introMarkup(site, { skip: "Skip intro" })}
    <main class="lintel-design"><h1 data-node-id="title">Made slowly</h1></main>
    <script type="application/json" id="lintel-motion">${motion}</script>`;
}

const titleAnimations = () =>
  document.querySelector("[data-node-id='title']")!.getAnimations().length;

describe("entrances under the site intro", () => {
  it("wait until the intro has lifted, then play", async () => {
    const { page } = await openEffectsPage(browser, pageWithEntrance(), [], {
      site: { ...site },
      css: introCss(site),
    });
    await waitFor(page, () => document.querySelector(".lintel-intro__count")?.textContent !== "0");
    // The intro is counting: the headline hasn't started underneath it.
    expect(await page.evaluate(() => document.querySelector(".lintel-intro") !== null)).toBe(true);
    expect(await page.evaluate(titleAnimations)).toBe(0);
    await waitFor(page, () => document.querySelector(".lintel-intro") === null);
    await waitFor(page, () => {
      const title = document.querySelector<HTMLElement>("[data-node-id='title']")!;
      return title.getAnimations().length > 0;
    });
    await page.close();
  });

  it("play at once when the intro was seen already this visit", async () => {
    const { page } = await openEffectsPage(browser, pageWithEntrance(), [], {
      site: { ...site },
      css: introCss(site),
    });
    await waitFor(page, () => document.querySelector(".lintel-intro") === null);
    await page.reload();
    await waitFor(page, () => document.querySelector(".lintel-intro") === null, 1000);
    await waitFor(
      page,
      () => document.querySelector("[data-node-id='title']")!.getAnimations().length > 0,
      1000,
    );
    await page.close();
  });

  it("shows the count in the font the site's headings use, once that font is ready", async () => {
    const { page } = await openEffectsPage(browser, pageWithEntrance(), [], {
      site: { ...site },
      // The theme says one font; Site styles give headings another, which is what shows.
      css: `:root { --lintel-font-heading: "Courier New", monospace; } .lintel-design h1 { font-family: Georgia, serif; } ${introCss(site)}`,
      // On a busy machine the intro can be over before the test looks, so the page notes
      // how the middle looked before and as it became ready.
      beforePageLoads: () => {
        const seen: { before?: string; ready?: { visibility: string; font: string } } = {};
        Object.assign(window, { introSeen: seen });
        new MutationObserver(() => {
          const intro = document.querySelector(".lintel-intro");
          const middle = intro?.querySelector(".lintel-intro__middle");
          const count = intro?.querySelector(".lintel-intro__count");
          if (!intro || !middle || !count || seen.ready) return;
          if (!intro.hasAttribute("data-ready")) {
            seen.before ??= getComputedStyle(middle).visibility;
            return;
          }
          seen.ready = {
            visibility: getComputedStyle(middle).visibility,
            font: getComputedStyle(count).fontFamily,
          };
        }).observe(document, { subtree: true, childList: true, attributes: true });
      },
    });
    type Seen = { before?: string; ready?: { visibility: string; font: string } };
    await waitFor(
      page,
      () => (window as unknown as { introSeen: Seen }).introSeen.ready !== undefined,
    );
    const { before, ready } = await page.evaluate(
      () => (window as unknown as { introSeen: Seen }).introSeen,
    );
    // Hidden until the module has the font, so it never counts in the device's own font.
    expect(before).toBe("hidden");
    expect(ready?.visibility).toBe("visible");
    expect(ready?.font).toMatch(/^Georgia/);
    await page.close();
  });
});
