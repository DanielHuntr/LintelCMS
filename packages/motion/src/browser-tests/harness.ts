import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";

/**
 * Starts Chromium and loads the runtime and presets into a blank page as `window.motion`
 * and `window.presets`, bundled straight from the source.
 */

const entry = `
  import * as motion from "./index.js";
  import * as presets from "./presets/index.js";
  Object.assign(window, { motion, presets });
`;

let bundle: Promise<string> | undefined;

function bundleRuntime(): Promise<string> {
  bundle ??= build({
    stdin: {
      contents: entry,
      resolveDir: fileURLToPath(new URL("..", import.meta.url)),
      loader: "ts",
    },
    bundle: true,
    format: "iife",
    write: false,
  }).then((result) => result.outputFiles[0]?.text ?? "");
  return bundle;
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch();
}

/** A fresh page with `html` in its body, plus a stylesheet, and the runtime loaded. */
export async function openPage(browser: Browser, html: string, css = ""): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(
    `<!doctype html><html><head><style>body{margin:0;font:16px sans-serif}${css}</style></head><body>${html}</body></html>`,
  );
  await page.addScriptTag({ content: await bundleRuntime() });
  return page;
}

/** Waits for two frames, so scroll and pointer handlers have run. */
export async function nextFrames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}
