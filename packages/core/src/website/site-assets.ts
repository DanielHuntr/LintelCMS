import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { createRequire } from "node:module";
import { findIllustration, fontFilesFolder, isCatalogueFontFile } from "@lintel/builder-model";
import { STYLESHEET_FOLDER } from "./site-context.service.js";

/**
 * The website's files besides pages and the stylesheet: the motion runtime (only pages with
 * animations or effects load it), the effect modules (each only where an effect uses it), the elements script (only pages with sliders, forms and the like load
 * it), the illustrations the starter sites and the section library use, and the fonts that
 * come with Lintel. All are served from `/_lintel`, with fingerprints or long caching.
 */

export interface SiteScript {
  code: string;
  /** The address it is served at, which changes with its contents. */
  path: string;
}

let motionRuntime: SiteScript | null | undefined;

/** The built motion runtime, read once. Null if `@lintel/motion` hasn't been built. */
export function readMotionRuntime(): SiteScript | null {
  if (motionRuntime !== undefined) {
    return motionRuntime;
  }
  try {
    const file = createRequire(import.meta.url).resolve("@lintel/motion/site-runtime.js");
    const code = readFileSync(file, "utf8");
    const fingerprint = createHash("sha256").update(code).digest("hex").slice(0, 12);
    motionRuntime = { code, path: `${STYLESHEET_FOLDER}/motion-${fingerprint}.js` };
  } catch {
    motionRuntime = null;
  }
  return motionRuntime;
}

let elementsScript: SiteScript | null | undefined;

/**
 * The elements script (sliders, tabs, pop-ups, forms, the basket), read once. Only pages
 * whose design has such elements load it. Null if `@lintel/builder` hasn't been built.
 */
export function readElementsScript(): SiteScript | null {
  if (elementsScript !== undefined) {
    return elementsScript;
  }
  try {
    const file = createRequire(import.meta.url).resolve("@lintel/builder/site-behaviours.js");
    const code = readFileSync(file, "utf8");
    const fingerprint = createHash("sha256").update(code).digest("hex").slice(0, 12);
    elementsScript = { code, path: `${STYLESHEET_FOLDER}/elements-${fingerprint}.js` };
  } catch {
    elementsScript = null;
  }
  return elementsScript;
}

let cookieNoticeScript: SiteScript | null | undefined;

/**
 * The cookie notice's script, read once. Only sites that ask visitors about cookies load it
 * (see src/cookie-notice). Null if `@lintel/builder` hasn't been built.
 */
export function readCookieNoticeScript(): SiteScript | null {
  if (cookieNoticeScript !== undefined) {
    return cookieNoticeScript;
  }
  try {
    const file = createRequire(import.meta.url).resolve("@lintel/builder/cookie-notice.js");
    const code = readFileSync(file, "utf8");
    const fingerprint = createHash("sha256").update(code).digest("hex").slice(0, 12);
    cookieNoticeScript = { code, path: `${STYLESHEET_FOLDER}/cookie-notice-${fingerprint}.js` };
  } catch {
    cookieNoticeScript = null;
  }
  return cookieNoticeScript;
}

export const EFFECTS_FOLDER = `${STYLESHEET_FOLDER}/effects`;

export interface EffectModuleFiles {
  /** Each module's address, for the page's list: { pointer: "/_lintel/effects/pointer-X.js" }. */
  urls: Record<string, string>;
  /** Every file (modules and their shared chunks) by name. */
  files: ReadonlySet<string>;
  folder: string;
}

let effectModules: EffectModuleFiles | null | undefined;

/**
 * The effect modules (`@lintel/motion/effect-modules`), from their manifest, read once.
 * Pages only list the modules their effects use. Null if `@lintel/motion` isn't built.
 */
export function readEffectModules(): EffectModuleFiles | null {
  if (effectModules !== undefined) {
    return effectModules;
  }
  try {
    const manifestPath = createRequire(import.meta.url).resolve(
      "@lintel/motion/effect-modules/manifest.json",
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      modules: Record<string, { file: string }>;
      files: string[];
    };
    effectModules = {
      urls: Object.fromEntries(
        Object.entries(manifest.modules).map(([name, { file }]) => [
          name,
          `${EFFECTS_FOLDER}/${file}`,
        ]),
      ),
      files: new Set(manifest.files),
      folder: dirname(manifestPath),
    };
  } catch {
    effectModules = null;
  }
  return effectModules;
}

/** One effect module or shared chunk by file name, or undefined. File names have fingerprints. */
export function readEffectFile(fileName: string): string | undefined {
  const modules = readEffectModules();
  if (!modules?.files.has(fileName)) {
    return undefined;
  }
  return readFileSync(`${modules.folder}/${fileName}`, "utf8");
}

export const ILLUSTRATIONS_FOLDER = `${STYLESHEET_FOLDER}/illustrations`;

/** An illustration by its file name ("bakery-loaf.svg"), or undefined. */
export function readIllustration(fileName: string): string | undefined {
  const name = /^([a-z0-9-]+)\.svg$/.exec(fileName)?.[1];
  return name ? findIllustration(name) : undefined;
}

export const FONTS_FOLDER = fontFilesFolder;

const fontFiles = new Map<string, Buffer>();

/** One of the bundled fonts' files by name ("inter-latin-400-normal.woff2"), or undefined. */
export function readFontFile(fileName: string): Buffer | undefined {
  if (!isCatalogueFontFile(fileName)) {
    return undefined;
  }
  const cached = fontFiles.get(fileName);
  if (cached) {
    return cached;
  }
  try {
    const path = createRequire(import.meta.url).resolve(`@lintel/builder-model/fonts/${fileName}`);
    const contents = readFileSync(path);
    fontFiles.set(fileName, contents);
    return contents;
  } catch {
    return undefined;
  }
}
