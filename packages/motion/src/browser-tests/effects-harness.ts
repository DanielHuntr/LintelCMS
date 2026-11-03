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
  /** Pretends the browser has no cross-document view transitions, to test the fallback. */
  withoutViewTransitions?: boolean;
  /** Pretends the browser can't draw WebGL, as on some old or locked-down computers. */
  withoutWebGL?: boolean;
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
    viewport: { width: 1000, height: 700 },
    reducedMotion: options.reducedMotion ?? "no-preference",
  });
  if (options.withoutViewTransitions) {
    await page.addInitScript(() => {
      delete (window as Partial<Window & { CSSViewTransitionRule: unknown }>).CSSViewTransitionRule;
    });
  }
  if (options.withoutWebGL) {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        ...rest: unknown[]
      ) {
        return kind.startsWith("webgl")
          ? null
          : (original as (...args: unknown[]) => unknown).call(this, kind, ...rest);
      } as typeof original;
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
      return route.fulfill({
        contentType: "text/javascript",
        body: readFileSync(`${dist}effect-modules/${path.split("/").pop()}`, "utf8"),
      });
    }
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

export { document as effectsDocument };

/** Waits until `check` in the page is true, or fails after `timeout`. */
export async function waitFor(page: Page, check: () => boolean, timeout = 5000): Promise<void> {
  await page.waitForFunction(check, undefined, { timeout });
}
