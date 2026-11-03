import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "playwright";

/**
 * Pages for the effects tests, served from a made-up address so the effect modules load
 * exactly as on a website: the built site runtime (dist/site-runtime.js) reads the page's
 * `lintel-effects` list and imports modules from dist/effect-modules. Run `pnpm build` first.
 */

const dist = fileURLToPath(new URL("../../dist/", import.meta.url));
const sampleModels = fileURLToPath(new URL("../../sample-models/", import.meta.url));
export const origin = "http://effects.test";

interface Manifest {
  modules: Record<string, { file: string }>;
}

export function readManifest(): Manifest {
  return JSON.parse(readFileSync(`${dist}effect-modules/manifest.json`, "utf8")) as Manifest;
}

export interface EffectOnTest {
  nodeId: string;
  module: string;
  behaviour: string;
  params?: Record<string, number | string | boolean>;
}

export interface OpenOptions {
  css?: string;
  site?: Record<string, unknown>;
  reducedMotion?: "reduce" | "no-preference";
  /** Extra pages by path, for following links. */
  pages?: Record<string, string>;
  /** Other files by path, such as an animation: served with their own type. */
  files?: Record<string, { type: string; body: Buffer | string }>;
  /** A touch screen, for tapping and swiping. */
  touch?: boolean;
  /** The window's size; 1000 by 700 unless given. */
  viewport?: { width: number; height: number };
  /** Pretends the browser has no cross-document view transitions, to test the fallback. */
  withoutViewTransitions?: boolean;
  /** Pretends the browser has no WebGL, to test the shader effects' fallbacks. */
  withoutWebGl?: boolean;
}

function document(html: string, effects: readonly EffectOnTest[], options: OpenOptions) {
  const manifest = readManifest();
  const modules = Object.fromEntries(
    Object.entries(manifest.modules).map(([name, { file }]) => [name, `/_lintel/effects/${file}`]),
  );
  const data = JSON.stringify({
    modules,
    bindings: effects.map((effect) => ({ params: {}, ...effect })),
    site: options.site,
  }).replace(/</g, "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;font:16px sans-serif}${options.css ?? ""}</style>
<script type="application/json" id="lintel-effects">${data}</script>
<script src="/_lintel/motion.js" defer></script></head><body>${html}</body></html>`;
}

/** Opens `html` with these effects, the way a published page would carry them. */
export async function openEffectsPage(
  browser: Browser,
  html: string,
  effects: readonly EffectOnTest[],
  options: OpenOptions = {},
): Promise<{ page: Page; requested: string[] }> {
  const page = await browser.newPage({
    viewport: options.viewport ?? { width: 1000, height: 700 },
    hasTouch: options.touch === true,
    reducedMotion: options.reducedMotion ?? "no-preference",
  });
  if (options.withoutViewTransitions) {
    await page.addInitScript(() => {
      delete (window as Partial<Window & { CSSViewTransitionRule: unknown }>).CSSViewTransitionRule;
    });
  }
  if (options.withoutWebGl) {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        value(this: HTMLCanvasElement, kind: string, settings?: unknown) {
          return kind.startsWith("webgl") ? null : original.call(this, kind as "2d", settings);
        },
      });
    });
  }
  const requested: string[] = [];
  await page.route(`${origin}/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    requested.push(path);
    if (path === "/_lintel/motion.js") {
      return route.fulfill({
        contentType: "text/javascript",
        body: readFileSync(`${dist}site-runtime.js`, "utf8"),
      });
    }
    if (path.startsWith("/_lintel/effects/")) {
      const name = path.split("/").pop() ?? "";
      return route.fulfill({
        contentType: effectFileType(name),
        body: readFileSync(`${dist}effect-modules/${name}`),
      });
    }
    const file = options.files?.[path];
    if (file) return route.fulfill({ contentType: file.type, body: file.body });
    if (path.startsWith("/sample-models/")) {
      const file = `${sampleModels}${path.split("/").pop()}`;
      if (!existsSync(file)) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({
        contentType: "model/gltf-binary",
        body: readFileSync(file),
      });
    }
    const body = path === "/" ? document(html, effects, options) : options.pages?.[path];
    return body === undefined
      ? route.fulfill({ status: 404, body: "" })
      : route.fulfill({
          // Pictures are served as pictures, so they load and have a size.
          contentType: path.endsWith(".svg") ? "image/svg+xml" : "text/html",
          body,
        });
  });
  await page.goto(`${origin}/`);
  return { page, requested };
}

/** The type a file beside the effect modules is served as. */
function effectFileType(name: string): string {
  if (name.endsWith(".wasm")) return "application/wasm";
  if (name.endsWith(".json")) return "application/json";
  if (name.endsWith(".riv")) return "application/octet-stream";
  return "text/javascript";
}

export { document as effectsDocument };

/** Waits until `check` in the page is true, or fails after `timeout`. */
export async function waitFor(page: Page, check: () => boolean, timeout = 5000): Promise<void> {
  await page.waitForFunction(check, undefined, { timeout });
}
