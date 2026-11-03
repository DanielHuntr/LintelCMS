import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/*
 * The cookie notice with the real bundled scripts: nothing from YouTube or OpenStreetMap is
 * asked for until the visitor accepts, then the embeds load where they are, without a reload.
 */

const origin = "https://bakery.test";
const dist = join(dirname(fileURLToPath(import.meta.url)), "../../dist");
const settings = {
  storageKey: "lintel-consent:s1",
  version: "openstreetmap youtube",
  services: [
    { id: "openstreetmap", name: "OpenStreetMap" },
    { id: "youtube", name: "YouTube" },
  ],
  position: "bar",
  heading: "Cookies",
  message: "This site uses OpenStreetMap and YouTube, which may set cookies.",
  privacyUrl: null,
  fontStylesheets: [],
  labels: {
    acceptAll: "Accept all",
    onlyNecessary: "Only necessary",
    choose: "Choose",
    save: "Save my choices",
    privacy: "Privacy",
    servicesList: "Choose what can load",
  },
};
const frame = (service: string, src: string) =>
  `<div class="lintel-consent" data-behaviour="consent-frame" data-frame-src="${src}" data-frame-title="${service}" data-consent-service="${service}"><button class="lintel-consent__load">Load</button></div>`;
const html = `<!doctype html><html lang="en-GB"><head>
<script type="application/json" id="lintel-cookie-notice">${JSON.stringify(settings)}</script>
<script src="/cookie-notice.js" defer></script><script src="/site-behaviours.js" defer></script>
</head><body><a class="lintel-skip-link" href="#main-content">Skip</a>
<main id="main-content" tabindex="-1"><h1>Visit us</h1>
${frame("youtube", "https://www.youtube-nocookie.com/embed/abc?autoplay=1")}
${frame("openstreetmap", "https://www.openstreetmap.org/export/embed.html")}
</main><footer><button data-lintel-cookie-settings>Cookie settings</button></footer></body></html>`;

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

async function open(): Promise<{ tab: Page; outside: string[] }> {
  const tab = await browser.newPage();
  const outside: string[] = [];
  await tab.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      outside.push(url.hostname);
      return route.fulfill({ contentType: "text/html", body: "<p>outside</p>" });
    }
    if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
    return route.fulfill({
      contentType: "text/javascript",
      body: readFileSync(join(dist, url.pathname.slice(1))),
    });
  });
  await tab.goto(`${origin}/`);
  return { tab, outside };
}

describe("the cookie notice in a browser", () => {
  it("loads nothing from elsewhere until accepted, then loads the embeds in place", async () => {
    const { tab, outside } = await open();
    const notice = tab.getByRole("region", { name: "Cookies" });
    await expect(notice.isVisible()).resolves.toBe(true);
    expect(await tab.evaluate(() => document.activeElement === document.body)).toBe(true);
    expect(outside).toEqual([]);
    await tab.getByRole("button", { name: "Accept all" }).click();
    await tab.waitForFunction(() => document.querySelectorAll("iframe").length === 2);
    expect(await notice.count()).toBe(0);
    expect(outside.sort()).toEqual(["www.openstreetmap.org", "www.youtube-nocookie.com"]);

    await tab.reload();
    await tab.waitForFunction(() => document.querySelectorAll("iframe").length === 2);
    expect(await tab.getByRole("region", { name: "Cookies" }).count()).toBe(0);
    await tab.close();
  });

  it("keeps placeholders with Only necessary, and Cookie settings opens the choices again", async () => {
    const { tab, outside } = await open();
    await tab.keyboard.press("Tab");
    await tab.keyboard.press("Tab");
    expect(await tab.evaluate(() => document.activeElement?.textContent)).toBe("Accept all");
    await tab.getByRole("button", { name: "Only necessary" }).click();
    expect(await tab.locator("iframe").count()).toBe(0);
    await tab.getByRole("button", { name: "Cookie settings" }).click();
    await tab.getByRole("switch", { name: "YouTube" }).check();
    await tab.getByRole("button", { name: "Save my choices" }).click();
    await tab.waitForFunction(() => document.querySelectorAll("iframe").length === 1);
    expect(outside).toEqual(["www.youtube-nocookie.com"]);
    await tab.close();
  });
});
