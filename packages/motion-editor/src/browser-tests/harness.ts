import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";

/**
 * Starts Chromium and opens the studio in a blank page, bundled straight from the source with
 * the Tailwind classes it uses. The host's design tokens are left out: these tests check
 * layout and pointer handling, not colours.
 */

const sourceFolder = fileURLToPath(new URL("..", import.meta.url));

const entry = `
  import { createElement } from "react";
  import { createRoot } from "react-dom/client";
  import { findPreset } from "@lintel/motion/presets";
  import { MotionStudio } from "./index.js";

  window.studioChanges = [];
  window.openStudio = (presetId) => {
    const preset = findPreset(presetId);
    createRoot(document.getElementById("root")).render(
      createElement(MotionStudio, {
        initialSpec: preset.spec,
        initialPresetId: presetId,
        initialView: "advanced",
        onChange: (spec) => window.studioChanges.push(spec),
      }),
    );
  };
`;

let bundle: Promise<string> | undefined;
let stylesheet: Promise<string> | undefined;

function bundleStudio(): Promise<string> {
  bundle ??= build({
    stdin: { contents: entry, resolveDir: sourceFolder, loader: "ts" },
    bundle: true,
    format: "iife",
    write: false,
    jsx: "automatic",
    conditions: ["development"],
    define: { "process.env.NODE_ENV": '"development"' },
  }).then((result) => result.outputFiles[0]?.text ?? "");
  return bundle;
}

function buildStylesheet(): Promise<string> {
  stylesheet ??= (async () => {
    const compiler = await compile('@import "tailwindcss";', {
      base: sourceFolder,
      onDependency: () => undefined,
    });
    const scanner = new Scanner({
      sources: [{ base: sourceFolder, pattern: "**/*.tsx", negated: false }],
    });
    return compiler.build(scanner.scan());
  })();
  return stylesheet;
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch();
}

/** A fresh page with the studio open on the timeline, editing the named preset. */
export async function openStudio(browser: Browser, presetId: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.setContent(
    `<!doctype html><html><head><style>${await buildStylesheet()}</style></head><body><div id="root"></div></body></html>`,
  );
  await page.addScriptTag({ content: await bundleStudio() });
  await page.evaluate((id) => window.openStudio(id), presetId);
  return page;
}
