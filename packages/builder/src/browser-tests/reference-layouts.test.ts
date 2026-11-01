import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  referenceLayouts,
  renderReferenceWebsite,
  stylesheetPath,
} from "../../test-fixtures/reference-layouts/render-reference.js";

/*
 * The reference layouts (test-fixtures/reference-layouts) are pages built only from what the
 * builder offers. They must stay valid documents, fit every screen without sideways
 * scrolling, and read in Layers order however they are turned, cut or stacked.
 */

const mediaFolder = fileURLToPath(
  new URL("../../test-fixtures/reference-layouts/media/", import.meta.url),
);
const fontsFolder = dirname(
  createRequire(import.meta.url).resolve(
    "@lintel/builder-model/fonts/inter-latin-400-normal.woff2",
  ),
);
const origin = "http://reference.test";
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
});

async function open(html: string, css: string, width: number): Promise<Page> {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.route(`${origin}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/") return route.fulfill({ contentType: "text/html", body: html });
    if (path === stylesheetPath) return route.fulfill({ contentType: "text/css", body: css });
    if (path.startsWith("/_lintel/fonts/")) {
      return route.fulfill({ body: readFileSync(join(fontsFolder, basename(path))) });
    }
    if (path.startsWith("/reference-media/")) {
      return route.fulfill({
        contentType: "image/svg+xml",
        body: readFileSync(join(mediaFolder, basename(path))),
      });
    }
    return route.fulfill({ status: 404, body: "" });
  });
  await page.goto(`${origin}/`);
  return page;
}

describe("the reference layouts on the website", () => {
  for (const layout of referenceLayouts) {
    it(`draws ${layout.name} at every width, in reading order`, async () => {
      const { html, css } = renderReferenceWebsite(layout.document);
      const expected = layout.document.root.children
        .flatMap(function texts(node): string[] {
          const own = typeof node.props.text === "string" ? [node.props.text] : [];
          return [...own, ...node.children.flatMap(texts)];
        })
        .map((text) => text.replace(/\s+/g, " ").trim());
      for (const width of [1440, 768, 390]) {
        const page = await open(html, css, width);
        const tooWide = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(tooWide, `${layout.name} at ${width}px`).toBe(0);
        if (width === 1440) {
          const read = await page.$$eval(
            ".lintel-design h1, .lintel-design h2, .lintel-design h3, .lintel-design p",
            (elements) =>
              elements.map((element) => (element.textContent ?? "").replace(/\s+/g, " ").trim()),
          );
          expect(read.filter((text) => expected.includes(text))).toEqual(
            expected.filter((text) => read.includes(text)),
          );
          expect(read.length).toBeGreaterThan(3);
        }
        await page.close();
      }
    });
  }
});
