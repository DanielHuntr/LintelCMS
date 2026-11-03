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
  import { createElement, useState } from "react";
  import { createRoot } from "react-dom/client";
  import { findPreset } from "@lintel/motion/presets";
  import { MotionPanel, MotionStudio } from "./index.js";

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

  function PanelHost() {
    const [animations, setAnimations] = useState([]);
    const [effects, setEffects] = useState([]);
    return createElement(MotionPanel, {
      name: "Title",
      animations,
      effects,
      elementKind: "text",
      onChangeAnimations: (next) => {
        window.studioChanges.push(next.at(-1)?.spec);
        setAnimations(next);
      },
      onChangeEffects: setEffects,
      onPreviewSpec: () => undefined,
      onPreviewEffect: () => undefined,
      onStopPreview: () => undefined,
      showsTimeline: false,
    });
  }

  window.openMotionPanel = () => {
    createRoot(document.getElementById("root")).render(createElement(PanelHost));
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

/**
 * A fresh page with the Motion panel open for a heading, in a column as narrow as the
 * builder's side panel. `reducedMotion` stands in for the device setting.
 */
export async function openMotionPanel(
  browser: Browser,
  options: { width: number; reducedMotion: "reduce" | "no-preference" },
): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 800, height: 900 },
    reducedMotion: options.reducedMotion,
  });
  await page.setContent(
    `<!doctype html><html><head><style>${await buildStylesheet()}</style></head><body><div id="root" style="width:${options.width}px;font:13px system-ui,sans-serif"></div></body></html>`,
  );
  await page.addScriptTag({ content: await bundleStudio() });
  await page.evaluate(() => window.openMotionPanel());
  return page;
}

/**
 * A fresh page with the studio open on the timeline, editing the named preset. `width` puts
 * it in a column that narrow, as in the builder's side panel, in a wide window.
 */
export async function openStudio(
  browser: Browser,
  presetId: string,
  options: { width?: number } = {},
): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: options.width ? 1440 : 1200, height: 900 },
  });
  const width = options.width
    ? ` style="width:${options.width}px;font:13px system-ui,sans-serif"`
    : "";
  await page.setContent(
    `<!doctype html><html><head><style>${await buildStylesheet()}</style></head><body><div id="root"${width}></div></body></html>`,
  );
  await page.addScriptTag({ content: await bundleStudio() });
  await page.evaluate((id) => window.openStudio(id), presetId);
  return page;
}
