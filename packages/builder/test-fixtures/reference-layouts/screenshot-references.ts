// Renders the reference layouts through the website's renderer in Chromium at 1440, 768 and
// 390 pixels wide, and saves each next to the picture it was rebuilt from:
//
//   pnpm --filter @lintel/builder exec tsx test-fixtures/reference-layouts/screenshot-references.ts \
//     <folder for the screenshots> <folder with the reference pictures>
//
// Nothing is served: Playwright answers the page's requests from the files here.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { referenceLayouts, renderReferenceWebsite, stylesheetPath } from "./render-reference.js";

const here = dirname(fileURLToPath(import.meta.url));
const fontsFolder = dirname(
  createRequire(import.meta.url).resolve(
    "@lintel/builder-model/fonts/inter-latin-400-normal.woff2",
  ),
);
const [
  outputFolder = "/tmp/lintel-p6-powerups-shots",
  referencesFolder = "/tmp/lintel-design-refs",
] = process.argv.slice(2);
const origin = "http://reference.test";
const screens = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;

mkdirSync(outputFolder, { recursive: true });

async function serve(page: Page, html: string, css: string) {
  await page.route(`${origin}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") return route.fulfill({ contentType: "text/html", body: html });
    if (path === stylesheetPath) return route.fulfill({ contentType: "text/css", body: css });
    if (path.startsWith("/_lintel/fonts/")) {
      return route.fulfill({
        contentType: "font/woff2",
        body: readFileSync(join(fontsFolder, basename(path))),
      });
    }
    if (path.startsWith("/reference-media/")) {
      return route.fulfill({
        contentType: "image/svg+xml",
        body: readFileSync(join(here, "media", basename(path))),
      });
    }
    return route.fulfill({ status: 404, body: "" });
  });
}

const browser = await chromium.launch();
try {
  for (const layout of referenceLayouts) {
    const { html, css } = renderReferenceWebsite(layout.document);
    const reference = readFileSync(join(referencesFolder, `${layout.name}.png`)).toString("base64");
    for (const screen of screens) {
      const page = await browser.newPage({ viewport: screen });
      await serve(page, html, css);
      await page.goto(`${origin}/`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 0)
        process.stdout.write(`${layout.name} at ${screen.width}px: ${overflow}px too wide\n`);
      // A full-page capture of the design's area: the site's sticky header stays at the top
      // of the page instead of floating over the design, as it would after scrolling.
      const area = await page.locator(".lintel-design").boundingBox();
      if (!area) throw new Error(`${layout.name} has no design on the page`);
      const shot = await page.screenshot({ fullPage: true, clip: area });
      const file = join(outputFolder, `${layout.name}-${screen.width}.png`);
      writeFileSync(file, shot);
      await page.close();

      const sideBySide = await browser.newPage({ viewport: { width: 1800, height: 900 } });
      await sideBySide.setContent(`<!doctype html><html><body style="margin:0;font:600 14px system-ui;background:#fff">
        <div style="display:flex;gap:16px;padding:16px;align-items:flex-start">
          <figure style="margin:0;flex:1"><figcaption style="padding:0 0 8px">Reference</figcaption>
            <img style="width:100%;display:block" src="data:image/png;base64,${reference}"></figure>
          <figure style="margin:0;flex:${screen.width === 1440 ? 1 : 0.6}"><figcaption style="padding:0 0 8px">Lintel, website renderer, ${screen.width}px</figcaption>
            <img style="width:100%;display:block;outline:1px solid #ddd" src="data:image/png;base64,${shot.toString("base64")}"></figure>
        </div></body></html>`);
      await sideBySide.screenshot({
        path: join(outputFolder, `${layout.name}-${screen.width}-side-by-side.png`),
        fullPage: true,
      });
      await sideBySide.close();
      process.stdout.write(`${file}\n`);
    }
  }
} finally {
  await browser.close();
}
